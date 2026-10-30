import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Save } from "lucide-react";

import ProjectForm from "../components/forms/ProjectForm";
import { ErrorState, Loading } from "../components/ui/States";
import { Note, PageHeader } from "../components/ui/Primitives";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import {
  pointMoved,
  toProjectRequest,
  validateProjectForm,
  valuesFromProject,
  type ProjectFormValues,
} from "../lib/projectForm";
import type { Project } from "../lib/types";

/* ---------------------------------------------------------------------------
   Editing a project and its site.

   The same form as creating one, filled from what is stored. Two things are
   deliberately not here:

   - Status. The backend sets it, and nothing in the UI decides when a project
     becomes "In Progress", so offering a picker would let someone label a
     project complete without anything behind the label.
   - Deleting the project. DELETE exists and cascades to its assessments,
     baseline and results, which is too much to hang on a button added in
     passing.
--------------------------------------------------------------------------- */

/** The form itself, mounted only once the project has arrived.
 *
 *  Split from the loader so the fields can be initialised from the stored
 *  project directly, rather than starting empty and being filled by an effect
 *  that would briefly show a blank form and could overwrite edits in progress
 *  if the project were ever refetched. */
function EditForm({ project }: { project: Project }) {
  const navigate = useNavigate();

  const stored = useMemo(() => valuesFromProject(project), [project]);
  const [values, setValues] = useState<ProjectFormValues>(stored);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const invalid = validateProjectForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await api.updateProject(project.id, toProjectRequest(values));
      // Back to the project's own page, where the change is visible on the map
      // and in the site panel.
      navigate(`/projects/${project.id}/location`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProjectForm
      values={values}
      onChange={(patch) => {
        setValues((current) => ({ ...current, ...patch }));
        // The message named a field that may be the one just corrected, so it
        // goes as soon as anything changes rather than surviving until the
        // next submit.
        setError(null);
      }}
      onSubmit={submit}
      submitLabel="Save changes"
      submitIcon={Save}
      busy={busy}
      error={error}
      cancelTo={`/projects/${project.id}/location`}
      locationHint="Every provider is queried by this point, and the noise and air limits are selected by it."
      notice={
        // Compared against what was loaded, so this appears only once the
        // coordinates actually differ -- not merely because the field was
        // focused or reformatted.
        pointMoved(stored, values) && (
          <Note tone="warn" icon={AlertTriangle} title="This moves the site">
            Saving will not re-collect the environmental baseline. Anything already
            fetched was gathered for the old coordinates and will still read against
            them, so fetch the baseline again from the project page afterwards.
          </Note>
        )
      }
    />
  );
}

export default function EditProject() {
  const { id: projectId } = useParams<{ id: string }>();

  const project = useApi(
    () => (projectId ? api.getProject(projectId) : Promise.reject(new Error("No project."))),
    [projectId]
  );

  if (project.loading) return <Loading label="Loading the project..." />;
  if (project.error) return <ErrorState message={project.error} onRetry={project.reload} />;
  if (!project.data) return <ErrorState message="Project not found." />;

  const row = project.data.project;

  return (
    <div>
      <PageHeader
        eyebrow="Projects"
        title="Edit project"
        hint={`${row.name} — change the project details or move its site.`}
      />

      {/* Keyed by id: going from one project's edit page straight to another's
          keeps this route mounted, and without the key the second project
          would be shown the first one's values. */}
      <EditForm key={row.id} project={row} />
    </div>
  );
}
