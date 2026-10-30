import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import ProjectForm from "../components/forms/ProjectForm";
import { PageHeader } from "../components/ui/Primitives";
import { api } from "../lib/api";
import {
  EMPTY_PROJECT_FORM,
  toProjectRequest,
  validateProjectForm,
  type ProjectFormValues,
} from "../lib/projectForm";

/** Where this form sits in the whole flow. Only the current step's label shows
 *  on a narrow screen -- three labels and two rules in a 375px row squashes
 *  every one of them to an ellipsis. */
function Steps() {
  const steps = [
    { n: 1, label: "Project and site", current: true },
    { n: 2, label: "Environmental baseline", current: false },
    { n: 3, label: "Assessment inputs", current: false },
  ];

  return (
    <ol
      aria-label="Progress"
      className="mb-5 flex max-w-5xl items-center rounded-lg border border-line bg-surface px-4 py-3.5 sm:px-6"
    >
      {steps.map((step, index) => (
        <li key={step.n} className="flex min-w-0 flex-1 items-center last:flex-none">
          <span
            className="flex items-center gap-2"
            aria-current={step.current ? "step" : undefined}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.current
                  ? "bg-brand text-ink-inverse"
                  : "border border-line-strong text-ink-subtle"
              }`}
            >
              {step.n}
            </span>

            <span
              className={`truncate text-sm ${
                step.current ? "font-semibold text-ink" : "hidden text-ink-subtle sm:inline"
              }`}
            >
              {step.label}
            </span>
          </span>

          {index < steps.length - 1 && <span className="mx-3 h-px flex-1 bg-line sm:mx-4" />}
        </li>
      ))}
    </ol>
  );
}

export default function CreateProject() {
  const navigate = useNavigate();

  const [values, setValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
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
      const { project } = await api.createProject(toProjectRequest(values));
      navigate(`/projects/${project.id}/location`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Projects"
        title="Create a new project"
        hint="Enter the project details and its site. The site is saved with the project, so the environmental baseline can be fetched for that point next."
      />

      <Steps />

      <ProjectForm
        values={values}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          // The message named a field that may be the one just corrected, so
          // it goes as soon as anything changes rather than surviving until
          // the next submit.
          setError(null);
        }}
        onSubmit={submit}
        submitLabel="Create project"
        submitIcon={ArrowRight}
        busy={busy}
        error={error}
        cancelTo="/projects"
        locationHint="Saved with the project in one step. Every provider is queried by this point."
      />
    </div>
  );
}
