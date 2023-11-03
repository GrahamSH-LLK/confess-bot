/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const AWW_COMMAND = {
  name: 'awwww',
  description: 'Drop some cuteness on this channel.',
};

export const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
};
export const CONFESS_COMMAND = {
  name: 'confess',
  description: 'Do a confession',
  options: [
    {
      name: 'confession',
      description: 'The confession',
      type: 3,
      required: true,
    },
  ],
};
