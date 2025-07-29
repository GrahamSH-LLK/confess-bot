/**
 * The core server that runs on a Cloudflare worker.
 */

import { Router } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { AWW_COMMAND, CONFESS_COMMAND, INVITE_COMMAND } from './commands.js';
import { getCuteUrl } from './reddit.js';
import { InteractionResponseFlags } from 'discord-interactions';
import send from './webhooksend.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}
class HTMLResponse extends Response {
  constructor(body, init) {
    init = init || {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    };
    super(body, init);
  }
}


const router = Router();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return new HTMLResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Decrypt Confession</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem; }
    textarea { width: 100%; height: 150px; font-family: monospace; }
    input, button { width: 100%; margin-top: 1rem; padding: 0.5rem; }
  </style>
</head>
<body>
  <h2>🔓 Decrypt Confession</h2>

  <label for="privateKey">Private Key</label>
  <textarea id="privateKey" placeholder="-----BEGIN PRIVATE KEY-----\n..."></textarea>

  <label for="encrypted">Encrypted Message:</label>
  <textarea id="encrypted" placeholder="Base64 string..."></textarea>

  <button onclick="decrypt()">Decrypt</button>

  <h3>📜 Decrypted Result:</h3>
  <pre id="output" style="white-space: pre-wrap; background: #f3f3f3; padding: 1rem;"></pre>

  <script>
    async function decrypt() {
      const output = document.getElementById("output");
      const encryptedBase64 = document.getElementById("encrypted").value.trim();
      const privateKeyPem = document.getElementById("privateKey").value.trim();

      try {
        const privateKey = await importPrivateKey(privateKeyPem);
        const encryptedArrayBuffer = base64ToArrayBuffer(encryptedBase64);

        const decrypted = await crypto.subtle.decrypt(
          {
            name: "RSA-OAEP",
          },
          privateKey,
          encryptedArrayBuffer
        );

        const decoded = new TextDecoder().decode(decrypted);
        const parsed = JSON.parse(decoded);

        output.textContent = \`✅ Decrypted:\n\nUser: \${parsed.user}\nConfession number: \${parsed.number}\`;
      } catch (err) {
        console.error(err);
        output.textContent = \`❌ Failed to decrypt or parse:\n\${err.message}\`;
      }
    }

    function base64ToArrayBuffer(base64) {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    async function importPrivateKey(pem) {
      const pemHeader = "-----BEGIN PRIVATE KEY-----";
      const pemFooter = "-----END PRIVATE KEY-----";
      const pemContents = pem
        .replace(pemHeader, "")
        .replace(pemFooter, "")
        .replace(/\s+/g, "");
      const binaryDer = base64ToArrayBuffer(pemContents);

      return await crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        false,
        ["decrypt"]
      );
    }
  </script>
</body>
</html>
`);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case CONFESS_COMMAND.name.toLowerCase(): {
        console.log(
          interaction.member.user.id,
          interaction.member.user.username,
        );
        const currentId = parseInt(await env.confessions.get('id'));
        console.log('why the fuck');
        const confession = interaction.data.options[0].value;
        await send(confession, currentId + 1);
        await env.confessions.put('id', currentId + 1);
        const text = Buffer.from(
          JSON.stringify({
            user: interaction.member.user.username,
            number: currentId + 1,
          }),
        );
        const publicKey = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2YqHBPF6uglTrahFbngB
PvTpZp+2rxr4HKwyTd4h3/f8L1qvdGtyAwIZPC/pry2RGitCfA5tsJPMOnouks4g
Oyq9YEBKpBsPkjio0udZfNqBflefXJENMymlyhQG9dpu0BQE6AxpYXiXVjs05u/v
/U4AKsd57UIQjK44W28uzVvGe0GfJBiIOqHDN3Mh5HGvVB+DdDI3O2k1CXXFSXIL
Uq+37sWRIeWzPOwPB2NFKgDdAdYJCcOzqQWROgSv//22OfrbCDz6cVXAbYTJCFIc
VkQm1TpjHeEE97Mz3TnzG6Me4nihPGG4i9TD0JueIvDPZEawfe5O9J3QNqLM2TqQ
mQIDAQAB
-----END PUBLIC KEY-----
`;
        const encryptedData = crypto.publicEncrypt(
          {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, // Recommended padding scheme
            oaepHash: 'sha256', // Recommended hash algorithm for OAEP
          },
          text,
        );

        await env.confessions.put(
          `${currentId + 1}-confessions`,
          encryptedData.toString('base64'),
        );
        console.log(
          'hi',
          await env.confessions.get(`${currentId + 1}-confessions`),
        );
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Noted!',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
      case INVITE_COMMAND.name.toLowerCase(): {
        const applicationId = env.DISCORD_APPLICATION_ID;
        const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: INVITE_URL,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest: verifyDiscordRequest,
  fetch: async function (request, env) {
    return router.handle(request, env);
  },
};

export default server;
