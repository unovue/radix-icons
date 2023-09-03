# radix-icons

This is a fork of the original [@radix-ui/icons](https://github.com/radix-ui/icons).

It has been modified to work with both React and Vue.

## React

First, install `@radix-icons/react` from npm:

```sh
npm install @radix-icons/react
```

Now each icon can be imported individually as a React component:

```js
import { BellIcon } from '@radix-icons/react'

function MyComponent() {
  return (
    <div>
      <BellIcon className="h-6 w-6 text-blue-500" />
      <p>...</p>
    </div>
  )
}
```

## Vue

First, install `@radix-icons/vue` from npm:

```sh
npm install @radix-icons/vue
```

Now each icon can be imported individually as a Vue component:

```vue
<script setup>
import { BellIcon } from '@radix-icons/vue'
</script>

<template>
  <div>
    <BellIcon class="h-6 w-6 text-blue-500" />
    <p>...</p>
  </div>
</template>
```

## Contributing

We welcome any and all contributions! If you'd like to improve something, open an issue and/or a pull request so we can discuss it.

## Credits

- [Heroicons](https://github.com/tailwindlabs/heroicons)
- [@radix-ui/icons](https://github.com/radix-ui/icons)

## License

This library is MIT licensed.
