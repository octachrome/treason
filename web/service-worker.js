function openWindowWithUrl (targetUrl, clientWindows) {
  for (let i = 0, count = clientWindows.length; i < count; ++i) {
    if (clientWindows[i].url === targetUrl && 'focus' in clientWindows[i]) {
      clientWindows[i].focus();
      return clientWindows[i];
    }
  }

  // If site is cannot be opened, open in new window with url
  if (self.clients.openWindow) {
    self.clients.openWindow(targetUrl);
  }

  return null;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationUrl = event?.notification?.data?.url;
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
      .then(clientWindows => {
        const client = openWindowWithUrl(notificationUrl, clientWindows);
        client?.postMessage({
          name: 'notification:clicked',
          id: event?.action
        });
      })
      .catch(error => {
        console.error(error);
      })
  )
})