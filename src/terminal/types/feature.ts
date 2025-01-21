/**
 * Represents a terminal feature that can provide additional commands
 */
export interface Feature {
  /**
   * Loads and returns an array of commands provided by this feature
   */
  loadFeatureCommands: () => Promise<any[]>;
} 