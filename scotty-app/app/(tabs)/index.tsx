import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigation, useFocusEffect } from 'expo-router';
import ScottyHomeScreen from '@/components/ScottyHomeScreen';
import WidgetPanel from '@/components/WidgetPanel';
import { useApp } from '@/context/AppContext';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors, Shadows } from '@/constants/Theme';

export default function HomeScreen() {
  const [showQuestsModal, setShowQuestsModal] = useState(false);
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);
  const navigation = useNavigation();
  const { cycleInsight } = useApp();
  const isFirstFocus = useRef(true);

  // Cycle insight blurb each time this tab gains focus (skip first mount)
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      cycleInsight();
    }, [cycleInsight])
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.badgeButton}
          onPress={() => setShowWidgetPanel(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>Widgets</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <>
      <ScottyHomeScreen
        showQuestsModal={showQuestsModal}
        onCloseQuestsModal={() => setShowQuestsModal(false)}
        onOpenQuestsModal={() => setShowQuestsModal(true)}
      />
      <WidgetPanel
        visible={showWidgetPanel}
        onClose={() => setShowWidgetPanel(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  badgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 16,
    gap: 6,
    ...Shadows.sketchSm,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
  },
});
