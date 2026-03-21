# @net-vim/bridge

A platform-independent Node.js bridge that allows Net-Vim to access your local file system.

## Usage

You can run it directly using `npx`:

```bash
npx @net-vim/bridge [port] [root_directory]
```

Or install it globally:

```bash
npm install -g @net-vim/bridge
net-vim-bridge [port] [root_directory]
```

- `port`: Default is `8080`.
- `root_directory`: Default is current working directory.

## Connecting from Net-Vim

When you run the bridge, it will print a security key. Use the following command in Net-Vim to connect:

```vim
:ed bridge <port> <security-key>
```

## Security

The bridge uses a randomly generated UUID security key for authentication. Only clients with this key can access your files. It also implements basic path validation to prevent access outside the specified root directory.
