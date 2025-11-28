export const ok = (data: any, message = "OK") => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

export const fail = (message: string, status = 400, extra = {}) => ({
  success: false,
  message,
  status,
  ...extra,
  timestamp: new Date().toISOString()
});
