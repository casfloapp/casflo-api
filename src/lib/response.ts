export const ok = (data: any = null, message = 'OK') =>
  new Response(JSON.stringify({ status: 'success', data, message }), {
    headers: { 'Content-Type': 'application/json' },
  });

export const err = (message = 'Error', status = 400) =>
  new Response(JSON.stringify({ status: 'error', message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
