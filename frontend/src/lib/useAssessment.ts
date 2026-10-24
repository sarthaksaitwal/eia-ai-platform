import { useCallback, useMemo, useState } from "react";

import { api } from "./api";
import { useApi } from "./useApi";
import type { Assessment } from "./types";

/**
 * Resolves the assessment a project is currently being worked on, and
 * creates one when there is none.
 *
 * Inputs, baseline data and results all belong to an assessment rather than
 * to the project, so three pages need the same answer. The newest assessment
 * is the live one: assessment_number only ever increases.
 */
export function useLatestAssessment(projectId: string | undefined) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const assessments = useApi(
    () =>
      projectId
        ? api.listAssessments(projectId)
        : Promise.reject(new Error("No project.")),
    [projectId]
  );

  const assessment = useMemo<Assessment | undefined>(() => {
    const list = assessments.data?.assessments ?? [];
    if (!list.length) return undefined;
    return [...list].sort((a, b) => b.assessment_number - a.assessment_number)[0];
  }, [assessments.data]);

  const create = useCallback(async () => {
    if (!projectId) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.createAssessment(projectId);
      assessments.reload();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not start an assessment."
      );
    } finally {
      setCreating(false);
    }
  }, [projectId, assessments]);

  return {
    assessment,
    loading: assessments.loading,
    error: assessments.error,
    reload: assessments.reload,
    create,
    creating,
    createError,
  };
}
