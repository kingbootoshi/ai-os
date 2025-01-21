import { Command } from '../terminal/types/commands';

export interface TerminalFeature {
  loadFeatureCommands(): Promise<Command[]>;
}