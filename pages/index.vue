<template>
    <h1>Chat Room</h1>
    <ChatRoom />
    <slot />
    <PassphraseModal />
</template>

<script setup>
import PassphraseModal from '~/components/PassphraseModal.vue'
</script>