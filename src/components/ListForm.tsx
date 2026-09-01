import { createList, updateList } from "@/app/actions/lists";
import type { List } from "@/generated/prisma/client";

type ListFormProps = {
  list?: List;
};

const fieldClass =
  "w-full rounded-md border border-[#2c3440] bg-[#14181c] px-3 py-2 text-sm text-white placeholder:text-[#667] focus:border-[#00e054] focus:outline-none";

export const ListForm = ({ list }: ListFormProps) => {
  const action = list ? updateList.bind(null, list.id) : createList;

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">Nombre</span>
        <input
          name="name"
          required
          defaultValue={list?.name ?? ""}
          className={fieldClass}
          autoComplete="off"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">
          Descripción
        </span>
        <textarea
          name="description"
          rows={3}
          defaultValue={list?.description ?? ""}
          className={fieldClass}
        />
      </label>
      <button
        type="submit"
        className="rounded-full bg-[#00e054] px-5 py-2 text-sm font-semibold text-[#14181c] hover:bg-[#00c030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {list ? "Guardar lista" : "Crear lista"}
      </button>
    </form>
  );
};
