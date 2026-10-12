import React, {useState} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ChatScreen} from './src/screens/ChatScreen';
import {StudyMaterialsScreen} from './src/screens/StudyMaterialsScreen';

export default function App() {
  const [screen, setScreen] = useState<'materials' | 'chat'>(
    'materials',
  );

  return (
    <SafeAreaProvider>
      {screen === 'materials' ? (
        <StudyMaterialsScreen
          onStartStudying={() => setScreen('chat')}
        />
      ) : (
        <ChatScreen
          onBack={() => setScreen('materials')}
        />
      )}
    </SafeAreaProvider>
  );
}
