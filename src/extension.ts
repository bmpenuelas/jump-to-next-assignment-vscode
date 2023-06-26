// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// Constants
const assignmentCharacters: { [key: string]: string | string[] } = {
  default: "=",
  r: "<-",
  cobol: "==",
  sql: ":=",
  css: ":",
  yaml: ":",
  json: ":",
  vhdl: [":=", "<="],
  verilog: "=",
  systemverilog: "=",
};

// Helper methods
const moveTo = (
  editor: vscode.TextEditor,
  position: vscode.Position,
  selectionLen: number
) => {
  const newPosition = new vscode.Position(
    position.line,
    position.character + selectionLen
  );
  editor.selection = new vscode.Selection(position, newPosition);

  // Calculate the range to be centered
  const startLine = Math.max(position.line - 10, 0);
  const endLine = Math.min(position.line + 10, editor.document.lineCount - 1);
  const range = new vscode.Range(startLine, 0, endLine, 0);

  // Center the view on the range
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // This line of code will only be executed once when the extension is activated
  console.log('The extension "Jump To Next Assignment" is now active.');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "jumpToNextAssignment.jumpToNextAssignment",
    () => {
      // Get the active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return; // No active editor
      }

      // Get the selected text or expand to the whole word
      let selectedText = editor.document.getText(editor.selection);
      let searchSelection = editor.selection;

      if (!selectedText) {
        // No text selected, expand to the whole word
        const wordRange = editor.document.getWordRangeAtPosition(
          editor.selection.start
        );
        if (wordRange) {
          selectedText = editor.document.getText(wordRange);
          searchSelection = new vscode.Selection(
            wordRange.start,
            wordRange.end
          );
        }
      }

      if (!selectedText || !searchSelection) {
        return; // No text to search
      }

      // Get the user settings
      const allowCharsBeforeAssignOp = vscode.workspace
        .getConfiguration("jumpToNextAssignment")
        .get<boolean>("allowCharsBeforeAssignOp");

      // Get the file language
      const fileLanguage = editor.document.languageId;

      // Get the assignment characters based on the file language
      const assignmentCharacter = assignmentCharacters[fileLanguage] || "=";

      let pattern: RegExp;
      if (Array.isArray(assignmentCharacter)) {
        // Multiple assignment characters defined, create an alternation regex pattern
        const assignmentRegex = assignmentCharacter
          .map((char) => escapeRegex(char))
          .join("|");
        pattern = new RegExp(
          `\\b${escapeRegex(selectedText)}\\b${
            allowCharsBeforeAssignOp ? "[^=\r\n]*" : "\\s*"
          }(${assignmentRegex})(?!=)`,
          "g"
        );
      } else {
        // Single assignment character
        pattern = new RegExp(
          `\\b${escapeRegex(selectedText)}\\b${
            allowCharsBeforeAssignOp ? "[^=\r\n]*" : "\\s*"
          }${escapeRegex(assignmentCharacter)}(?!=)`,
          "g"
        );
      }

      // Get the current document's text
      const documentText = editor.document.getText();

      // Set the search starting position
      let currentPosition = searchSelection.end;
      let match: RegExpExecArray | null = null;

      while ((match = pattern.exec(documentText))) {
        const position = editor.document.positionAt(match.index);

        // Check if the match position is after the current cursor position
        if (
          position.isAfter(currentPosition) ||
          position.isEqual(currentPosition)
        ) {
          // Move the cursor to the matched position
          moveTo(editor, position, selectedText.length);
          return;
        }
      }

      // If no match found, wrap around and start from the top
      if (match === null) {
        currentPosition = new vscode.Position(0, 0);
        while ((match = pattern.exec(documentText))) {
          const position = editor.document.positionAt(match.index);

          // Check if the match position is after the current cursor position
          if (
            position.isAfter(currentPosition) ||
            position.isEqual(currentPosition)
          ) {
            // Move the cursor to the matched position
            moveTo(editor, position, selectedText.length);
            return;
          }
        }
      }

      vscode.window.showInformationMessage(
        `No assignment found for '${selectedText}'.`
      );
    }
  );

  // Register the command and add it to the context subscriptions
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

// Escape search character for regex
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
