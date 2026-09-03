import { btnPrimary, fieldClass } from "@/lib/ui";

type CreateTagFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  placeholder?: string;
};

export const CreateTagForm = ({
  action,
  submitLabel = "Crear etiqueta",
  placeholder = "épica / guerra, visual…",
}: CreateTagFormProps) => {
  return (
    <form
      action={action}
      className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
    >
      <label className="block min-w-0 flex-1 space-y-1">
        <span className="text-xs uppercase tracking-wide text-fog">
          Nueva etiqueta
        </span>
        <input
          name="name"
          required
          placeholder={placeholder}
          className={fieldClass}
          autoComplete="off"
          aria-label="Nombre de la nueva etiqueta"
        />
      </label>
      <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
        {submitLabel}
      </button>
    </form>
  );
};
