# Troubleshooting Users Not Loading on VPS

The issue "users not loading" (and the `ERR_CONNECTION_REFUSED` on port 3000) is caused by two separate problems:

1. **Database Permission (RLS):** The `users` table is protected by Row Level Security (RLS), and currently, it doesn't allow the Login page to see the names of people for selection before they sign in.
2. **Server Connectivity:** The frontend is trying to connect to port 3000 directly, which is failing. This usually means the backend server is either not running on the VPS, or it's crashed.

---

## Step 1: Update Database Permissions (RLS)

I have updated the `supabase_rls_setup.sql` file and pushed it to GitHub. You must apply it to your Supabase project:

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor**.
3. Copy the entire content of [supabase_rls_setup.sql](https://github.com/tnsnurb/yamazumi-depot/blob/main/supabase_rls_setup.sql) and run it.
4. This will allow the login page to fetch the names for the dropdown.

---

### Step 2: Check Server Status on VPS

The `ERR_CONNECTION_REFUSED` to port 3000 means the browser cannot reach the backend.

1. **Check if the server is running:**
    Connect via SSH and run:

    ```bash
    pm2 list
    ```

    If the `yamazumi` process is `stopped` or `errored`, restart it:

    ```bash
    pm2 restart yamazumi
    ```

2. **Check logs for errors:**
    If it keeps crashing, check the logs:

    ```bash
    pm2 logs yamazumi --lines 50
    ```

3. **Check listening ports:**
    Ensure the process is actually listening on port 3000:

    ```bash
    netstat -tulnp | grep 3000
    ```

---

### Step 3: Verify Nginx Configuration

If you follow the recommended guide, you should be accessing the site via **Port 80** (<http://78.140.243.79/>) and NOT Port 3000.

If you are currently typing `:3000` in your browser address bar, try removing it. Nginx is supposed to bridge the connection for you.

1. Check Nginx status:

    ```bash
    systemctl status nginx
    ```

2. Ensure Nginx is correctly configured to proxy to Port 3000 (refer to `vps_guide.md`).

---

### Summary of Fixed Files (Already Pushed to GitHub)

- [supabase_rls_setup.sql](file:///C:/Users/nurbo/.gemini/antigravity/scratch/yamazumi/supabase_rls_setup.sql): Updated to allow public read of user names.
