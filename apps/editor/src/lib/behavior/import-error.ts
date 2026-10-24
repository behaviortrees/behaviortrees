// Thrown by the importers for a file they can't read. Anything else thrown
// while importing is a bug in the importer, and gets reported as one.
export type InvalidFileReason = 'invalid_xml' | 'xml_doctype' | 'not_behavior_tree';

export class InvalidFileError extends Error {
  readonly reason: InvalidFileReason;

  constructor(message: string, reason: InvalidFileReason) {
    super(message);
    this.name = 'InvalidFileError';
    this.reason = reason;
  }
}
