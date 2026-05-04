// admin-web/src/services/api/bonuses.ts
import api from './index';

export interface DisburseAllPayload {
  driverBonus:  number;
  partnerBonus: number;
}

export interface DisburseCustomPayload {
  userIds:        string[];
  amount:         number;
  description?:   string;
  nonWithdrawable: boolean;
}

export const bonusesAPI = {
  preview:         ()                          => api.get('/admin/bonuses/onboarding/preview'),
  disburseAll:     (data: DisburseAllPayload)  => api.post('/admin/bonuses/onboarding', data),
  disburseCustom:  (data: DisburseCustomPayload) => api.post('/admin/bonuses/disburse', data),
};