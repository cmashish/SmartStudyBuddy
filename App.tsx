import React from 'react';
import {StatusBar} from 'react-native';
import {ChatScreen} from './src/screens/ChatScreen';

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ChatScreen />
    </>
  );
}
