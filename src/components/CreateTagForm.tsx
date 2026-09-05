import { btnPrimary, fieldClass } from "@/lib/ui";

type CreateTagFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  placeholder?: string;
};

export const CreateTagForm = ({
  action,
  submitLabel = "Crear",
  placeholder = "Nueva etiqueta",
}: CreateTagFormProps) => {
  return (
    <form action={action} className="flex items-center gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Nueva etiqueta</span>
        <input
          name="name"
          required
          placeholder={placeholder}
          className={fieldClass}
          autoComplete="off"
          aria-label="Nombre de la nueva etiqueta"
        />
      </label>
      <button type="submit" className={btnPrimary}>
        {submitLabel}
      </button>
    </form>
  );
};
