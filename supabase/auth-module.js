/* Supabase Auth compatibility helper. No local or demo credential fallback. */
(function (global) {
  'use strict';

  function createJayAuth(config) {
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('SUPABASE_SDK_MISSING');
    }
    if (!config || !config.url || !config.anonKey) {
      throw new Error('SUPABASE_CONFIG_MISSING');
    }

    var client = global.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    return {
      client: client,
      getSession: function () {
        return client.auth.getSession();
      },
      signIn: function (email, password) {
        return client.auth.signInWithPassword({ email: email, password: password });
      },
      signUp: function (email, password, metadata) {
        return client.auth.signUp({
          email: email,
          password: password,
          options: { data: metadata || {} },
        });
      },
      signOut: function () {
        return client.auth.signOut();
      },
      resetPassword: function (email, redirectTo) {
        return client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
      },
      onAuthStateChange: function (handler) {
        return client.auth.onAuthStateChange(handler);
      },
    };
  }

  global.createJayAuth = createJayAuth;
})(window);
