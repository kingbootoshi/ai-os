import { Command } from '../../../terminal/types/commands';
import { createNoteCommand } from './createNote';
import { editNoteCommand } from './editNote';
import { deleteNoteCommand } from './deleteNote';
import { listNotesCommand } from './listNotes';
import { searchNoteCommand } from './searchNote';

export const notesSubCommands: Command[] = [
  createNoteCommand,
  editNoteCommand,
  deleteNoteCommand,
  listNotesCommand,
  searchNoteCommand
];