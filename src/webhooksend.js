export default async function send(content, id) {
  console.log('why');
  await fetch(
    'https://discord.com/api/webhooks/1166891688850116629/hpvweetL48DkAMoChlpO_MOreYu2evaLPt8KlPeNdg4qUIwL0VyLEWCErVbeNVuOVlLc',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `Confession ${id}`,
            description: `${content}`,
            color: 5814783,
          },
        ],
      }),
    },
  );
}
