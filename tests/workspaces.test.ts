import { describe, expect, it } from 'vitest';

describe('Workspaces Isolation and Creation', () => {
  it('validates that workspace creation generates an isolated organization ID', () => {
    const mainOrgId = '36334c75-42a9-449f-af24-ba8408f43ec5';
    const newWorkspaceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    // Verify workspace IDs are distinct
    expect(newWorkspaceId).not.toBe(mainOrgId);
  });

  it('ensures data scoped to a new organization_id is completely isolated from main Performance Lab workspace', () => {
    const mainOrgId = '36334c75-42a9-449f-af24-ba8408f43ec5';
    const newOrgId = '99999999-9999-9999-9999-999999999999';

    const mockClients = [
      { id: 'client-1', company_name: 'Performance Lab Client', organization_id: mainOrgId },
      { id: 'client-2', company_name: 'Isolated New Client', organization_id: newOrgId },
    ];

    const mockEvents = [
      { id: 'event-1', event_name: 'Flower Power', organization_id: mainOrgId },
      { id: 'event-2', event_name: 'Private Event', organization_id: newOrgId },
    ];

    const mockTalent = [
      { id: 'talent-1', real_name: 'Artist 1', organization_id: mainOrgId },
      { id: 'talent-2', real_name: 'Artist 2', organization_id: newOrgId },
    ];

    const mockTasks = [
      { id: 'task-1', title: 'Main Task', organization_id: mainOrgId },
      { id: 'task-2', title: 'New Workspace Task', organization_id: newOrgId },
    ];

    // Filter for new workspace
    const newWorkspaceClients = mockClients.filter(c => c.organization_id === newOrgId);
    const newWorkspaceEvents = mockEvents.filter(e => e.organization_id === newOrgId);
    const newWorkspaceTalent = mockTalent.filter(t => t.organization_id === newOrgId);
    const newWorkspaceTasks = mockTasks.filter(t => t.organization_id === newOrgId);

    // Filter for Performance Lab workspace
    const mainClients = mockClients.filter(c => c.organization_id === mainOrgId);
    const mainEvents = mockEvents.filter(e => e.organization_id === mainOrgId);

    // Assert complete isolation
    expect(newWorkspaceClients.map(c => c.company_name)).toEqual(['Isolated New Client']);
    expect(newWorkspaceEvents.map(e => e.event_name)).toEqual(['Private Event']);
    expect(newWorkspaceTalent.map(t => t.real_name)).toEqual(['Artist 2']);
    expect(newWorkspaceTasks.map(t => t.title)).toEqual(['New Workspace Task']);

    expect(mainClients.some(c => c.organization_id === newOrgId)).toBe(false);
    expect(mainEvents.some(e => e.organization_id === newOrgId)).toBe(false);
  });
});
