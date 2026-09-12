import { api } from '../../api';
export const ApplicationService = {
  async getApplications() { return (await api('/api/admin/applications?type=membership')).items; },
  async getPendingCount() { return (await this.getApplications()).filter(a => a.status === 'pending').length; },
  async approveAndRegister(application) {
    const result = await api(`/api/admin/applications/membership/${application.id}`, { method: 'PATCH', json: { status: 'approved' } });
    return { application: { ...application, ...result } };
  },
  async rejectApplication(id, reason) {
    const result = await api(`/api/admin/applications/membership/${id}`, { method: 'PATCH', json: { status: 'rejected', rejectionReason: reason } });
    return { ...result, rejectionReason: reason };
  },
  async deleteApplication(id) { return api(`/api/admin/applications/membership/${id}`, { method: 'DELETE' }); }
};
