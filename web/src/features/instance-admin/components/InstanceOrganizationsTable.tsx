import { SettingsTable } from "@/src/components/SettingsTable/SettingsTable";
import { createDateTableColumn } from "@/src/components/design-system/table/columns/createDateTableColumn";
import { createLinkTableColumn } from "@/src/components/design-system/table/columns/createLinkTableColumn";
import { createNumberTableColumn } from "@/src/components/design-system/table/columns/createNumberTableColumn";
import { createTextTableColumn } from "@/src/components/design-system/table/columns/createTextTableColumn";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import { asyncTableData } from "@/src/features/instance-admin/components/asyncTableData";
import { api, type RouterOutputs } from "@/src/utils/api";

type OrganizationRow = RouterOutputs["instanceAdmin"]["organizations"][number];

const columns: LangfuseColumnDef<OrganizationRow>[] = [
  createLinkTableColumn<OrganizationRow>({
    accessorKey: "name",
    header: "Name",
    size: 220,
    getCell: (name, { row }) => ({
      type: "link",
      props: {
        path: `/organization/${row.original.id}`,
        value: name ?? row.original.id,
        title: `Open organization ${name ?? row.original.id}`,
      },
    }),
  }),
  createTextTableColumn<OrganizationRow, OrganizationRow["owners"]>({
    accessorKey: "owners",
    header: "Owners",
    size: 320,
    mapValue: (owners) =>
      owners
        ?.map((owner) =>
          owner.name && owner.email
            ? `${owner.name} (${owner.email})`
            : (owner.name ?? owner.email ?? "Unknown"),
        )
        .join(", "),
  }),
  createDateTableColumn<OrganizationRow>({
    accessorKey: "createdAt",
    header: "Created",
    size: 150,
  }),
  createNumberTableColumn<OrganizationRow>({
    accessorKey: "memberCount",
    header: "Members",
    size: 90,
  }),
  createNumberTableColumn<OrganizationRow>({
    accessorKey: "projectCount",
    header: "Projects",
    size: 90,
  }),
];

export function InstanceOrganizationsTable() {
  const organizations = api.instanceAdmin.organizations.useQuery();

  return (
    <SettingsTable
      tableName="instanceAdminOrganizations"
      columns={columns}
      data={asyncTableData(organizations)}
      noResultsMessage="No organizations yet."
    />
  );
}
