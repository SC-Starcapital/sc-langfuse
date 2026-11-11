import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { SettingsTable } from "@/src/components/SettingsTable/SettingsTable";
import { ConfirmationDialogController } from "@/src/components/design-system/ConfirmationDialogController/ConfirmationDialogController";
import { Form } from "@/src/components/design-system/Form/Form";
import { createBadgeListTableColumn } from "@/src/components/design-system/table/columns/createBadgeListTableColumn";
import { createTextTableColumn } from "@/src/components/design-system/table/columns/createTextTableColumn";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import { asyncTableData } from "@/src/features/instance-admin/components/asyncTableData";
import { api, type RouterOutputs } from "@/src/utils/api";

type OwnerRow = RouterOutputs["instanceAdmin"]["owners"][number];

function demoteDisabledReason(owner: OwnerRow) {
  if (owner.bootstrap) return "The bootstrap owner cannot be demoted.";
  if (owner.self) return "You cannot demote yourself.";
  return undefined;
}

export function SystemOwners() {
  const utils = api.useUtils();
  const owners = api.instanceAdmin.owners.useQuery();
  const form = useForm({ defaultValues: { email: "" } });
  const promote = api.instanceAdmin.promote.useMutation({
    onSuccess: async () => {
      form.reset();
      await utils.instanceAdmin.owners.invalidate();
    },
  });
  const demote = api.instanceAdmin.demote.useMutation({
    onSuccess: () => utils.instanceAdmin.owners.invalidate(),
  });

  return (
    <div className="flex flex-col gap-6">
      <Form
        density="compact"
        actions={[
          {
            id: "promote",
            type: "submit",
            text: "Promote to system owner",
            loading: promote.isPending,
          },
        ]}
        onSubmit={form.handleSubmit(({ email }) =>
          promote.mutate({ email: email.trim() }),
        )}
      >
        <Form.InputField
          control={form.control}
          name="email"
          label="Email"
          description="The user must have signed in at least once. System owners get owner rights in every organization and project."
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          required
        />
      </Form>
      <ConfirmationDialogController<OwnerRow>
        title="Demote system owner?"
        text={(owner) =>
          `${owner.email ?? owner.name ?? "This user"} loses owner rights in every organization they are not a member of.`
        }
        confirmLabel="Demote"
        variant="destructive"
        loading={demote.isPending}
        error={demote.error?.message}
        onAfterDismiss={demote.reset}
        onConfirm={async (owner) => {
          await demote.mutateAsync({ userId: owner.id });
        }}
      >
        {({ openDialog }) => (
          <SystemOwnersTable
            data={asyncTableData(owners)}
            onDemote={openDialog}
          />
        )}
      </ConfirmationDialogController>
    </div>
  );
}

function SystemOwnersTable({
  data,
  onDemote,
}: {
  data: ReturnType<typeof asyncTableData<OwnerRow>>;
  onDemote: (owner: OwnerRow) => void;
}) {
  const columns = useMemo<LangfuseColumnDef<OwnerRow>[]>(
    () => [
      createTextTableColumn<OwnerRow>({
        accessorKey: "name",
        header: "Name",
        size: 200,
      }),
      createTextTableColumn<OwnerRow>({
        accessorKey: "email",
        header: "Email",
        size: 260,
      }),
      createBadgeListTableColumn<OwnerRow>({
        id: "markers",
        header: "Role",
        size: 160,
        accessorFn: (owner) => [
          ...(owner.bootstrap ? ["Bootstrap"] : []),
          ...(owner.self ? ["You"] : []),
        ],
      }),
    ],
    [],
  );

  return (
    <SettingsTable
      tableName="instanceAdminOwners"
      columns={columns}
      data={data}
      actions={(owner) => {
        const reason = demoteDisabledReason(owner);
        return [
          {
            type: "item",
            id: "demote",
            title: "Demote",
            variant: "destructive",
            disabled: reason ? { reason } : undefined,
            onClick: () => onDemote(owner),
          },
        ];
      }}
      noResultsMessage="No system owners."
    />
  );
}
