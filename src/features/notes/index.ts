import { TerminalFeature } from '../featureTypes';
import { Command } from '../../terminal/types/commands';
import { notes } from './commands/notes';

const NotesFeature: TerminalFeature = {
  async loadFeatureCommands(): Promise<Command[]> {
    return [notes];
  }
};

export default NotesFeature;