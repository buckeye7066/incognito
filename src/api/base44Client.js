/*
  Stubbed data client to replace Base44. This provides minimal auth and entities objects.
  You can implement your own data storage or API calls here.
*/

export const base44 = {
  auth: {
    me: async () => null,
    requireUser: () => null,
    signOut: async () => {},
  },
  entities: {},
};

export default base44;
