const vscode = require('vscode');
const { Configuration, OpenAIApi } = require("openai");
const simpleGit = require('simple-git/promise');

async function promptForApiKey() {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Bitte geben Sie Ihren OpenAI-API-Schlüssel ein',
    password: true,
  });

  if (!apiKey) {
    vscode.window.showErrorMessage('Kein API-Schlüssel eingegeben. Die Erweiterung kann nicht verwendet werden.');
    return;
  }

  // Speichern Sie den API-Schlüssel in den Einstellungen
  const configuration = vscode.workspace.getConfiguration('clevercommit');
  await configuration.update('clevercommitAPIKEY', apiKey, vscode.ConfigurationTarget.Global);
}

async function generateCommitMessage() {
  const configuration = vscode.workspace.getConfiguration('clevercommit');
  const apiKey = configuration.get('clevercommitAPIKEY');

  if (!apiKey) {
    await promptForApiKey();
  }

  const git = simpleGit(vscode.workspace.rootPath);
  const diff = await git.diff(['--staged']);
  if (!diff) {
    vscode.window.showWarningMessage('Keine Änderungen im Staging-Bereich gefunden. Bitte fügen Sie Dateien zum Commit hinzu.');
    return;
  }

  const config = new Configuration({
    apiKey: configuration.get('clevercommitAPIKEY'),
  });

  const openai = new OpenAIApi(config);

  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Generate a commit message for the following code changes:\n\n${diff}`,
      max_tokens: 50,
      n: 1,
      stop: null,
      temperature: 0.5,
    });

    if (response.data.choices && response.data.choices.length > 0) {
      const commitMessage = response.data.choices[0].text.trim();
      await git.commit(commitMessage);
      vscode.window.showInformationMessage(`Commit erfolgreich erstellt: "${commitMessage}"`);
    } else {
      vscode.window.showErrorMessage('Fehler beim Generieren der Commit-Nachricht. Bitte versuchen Sie es erneut.');
    }
  } catch (error) {
    vscode.window.showErrorMessage('Fehler beim Generieren der Commit-Nachricht. Bitte überprüfen Sie Ihren API-Schlüssel und versuchen Sie es erneut.');
    console.error(error);
  }
}

function activate(context) {
  let disposable = vscode.commands.registerCommand('extension.autoCommit', async () => {
    await generateCommitMessage();
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
