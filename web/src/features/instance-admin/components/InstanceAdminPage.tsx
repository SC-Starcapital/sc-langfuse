import ContainerPage from "@/src/components/layouts/ContainerPage";
import { Tabs } from "@/src/components/design-system/Tabs/Tabs";
import { InstanceOrganizationsTable } from "@/src/features/instance-admin/components/InstanceOrganizationsTable";
import { SystemOwners } from "@/src/features/instance-admin/components/SystemOwners";

export function InstanceAdminPage() {
  return (
    <ContainerPage headerProps={{ title: "Instance administration" }}>
      <Tabs defaultValue="organizations">
        <div className="flex flex-col gap-4">
          <Tabs.List variant="underline" aria-label="Instance administration">
            <Tabs.Trigger value="organizations">Organizations</Tabs.Trigger>
            <Tabs.Trigger value="owners">System owners</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="organizations">
            <InstanceOrganizationsTable />
          </Tabs.Content>
          <Tabs.Content value="owners">
            <SystemOwners />
          </Tabs.Content>
        </div>
      </Tabs>
    </ContainerPage>
  );
}
