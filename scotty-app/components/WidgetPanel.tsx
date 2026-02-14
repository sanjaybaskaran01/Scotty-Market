import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useApp, FeatureToggles } from '../context/AppContext';
import { Colors, Shadows } from '../constants/Theme';
import ScottyIcon, { IconName } from '../constants/Icons';

interface WidgetPanelProps {
  visible: boolean;
  onClose: () => void;
}

const TOGGLES: { key: keyof FeatureToggles; label: string; icon: IconName }[] = [
  { key: 'insights', label: 'Wynter Insights', icon: 'sparkle' },
  { key: 'dailyQuests', label: 'Daily Quests', icon: 'target' },
  { key: 'summaryCards', label: 'Spend & Balance', icon: 'coin' },
  { key: 'budgetDashboard', label: 'Budget Dashboard', icon: 'cat_default' },
];

export default function WidgetPanel({ visible, onClose }: WidgetPanelProps) {
  const { featureToggles, setFeatureToggle } = useApp();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>WIDGETS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>DONE</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Toggle widgets to customize your home screen.
          </Text>

          {/* Toggle list */}
          {TOGGLES.map(({ key, label, icon }) => (
            <View key={key} style={styles.toggleRow}>
              <View style={styles.toggleIcon}>
                <ScottyIcon name={icon} size={20} color={Colors.ink} />
              </View>
              <Text style={styles.toggleLabel}>{label}</Text>
              <Switch
                value={featureToggles[key]}
                onValueChange={(val) => setFeatureToggle(key, val)}
                trackColor={{ false: '#ddd', true: Colors.coral }}
                thumbColor={Colors.white}
                ios_backgroundColor="#ddd"
              />
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.ink,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ink,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 20,
    fontWeight: '900',
    color: Colors.ink,
    letterSpacing: 2,
  },
  closeBtn: {
    backgroundColor: Colors.coral,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    ...Shadows.sketchSm,
  },
  closeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...Shadows.sketchSm,
  },
  toggleIcon: {
    marginRight: 12,
  },
  toggleLabel: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
  },
});
