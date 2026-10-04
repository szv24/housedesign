export interface RuleCheck {
  room: string;
  rule: string;
  ok: boolean;
  detail: string;
}

export interface DesignReport {
  checks: RuleCheck[];
  passed: number;
  failed: number;
}

export function buildDesignReport(checks: RuleCheck[]): DesignReport {
  const failed = checks.filter((c) => !c.ok).length;
  return { checks, passed: checks.length - failed, failed };
}
