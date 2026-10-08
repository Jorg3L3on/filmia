import { createListWithFeedback, updateListWithFeedback } from "@/app/actions/lists";
import { ListFormFields } from "@/components/ListFormFields";
import { PageHeader } from "@/components/PageHeader";
import type { List } from "@/db";
import { isFixedListSlug } from "@/lib/lists";

type ListFormProps = {
  list?: List;
};

export const ListForm = ({ list }: ListFormProps) => {
  const action = list
    ? updateListWithFeedback.bind(null, list.id)
    : createListWithFeedback;

  return (
    <ListFormFields
      action={action}
      editing={Boolean(list)}
      fixed={isFixedListSlug(list?.slug)}
      defaultName={list?.name ?? ""}
      defaultDescription={list?.description ?? ""}
      header={
        <PageHeader
          eyebrow="Listas"
          title={list ? "Editar lista" : "Nueva lista"}
          backHref={list ? `/listas/${list.id}` : "/listas"}
          backLabel="Volver"
        />
      }
    />
  );
};
