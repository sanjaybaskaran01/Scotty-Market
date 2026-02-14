import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { FoodType } from '../types';
import { Colors, Shadows } from '../constants/Theme';
import ScottyIcon from '../constants/Icons';

interface FoodButtonProps {
  type: FoodType;
  name: string;
  cost: number;
  credits: number;
  disabled?: boolean;
  onPress: () => void;
}

export function FoodButton({
  type,
  name,
  cost,
  credits,
  disabled,
  onPress,
}: FoodButtonProps) {
  const canAfford = credits >= cost;
  const isDisabled = disabled || !canAfford;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        type === 'meal' ? styles.mealButton : styles.treatButton,
        isDisabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <ScottyIcon name={type === 'meal' ? 'meat' : 'bone'} size={32} color={Colors.ink} />
      </View>
      <Text style={[styles.name, isDisabled && styles.disabledText]}>
        {name}
      </Text>
      <View style={[styles.costBadge, !canAfford && styles.insufficientBadge]}>
        <View style={styles.costRow}>
          <Text style={[styles.cost, !canAfford && styles.insufficientText]}>
            {cost}{' '}
          </Text>
          <ScottyIcon name="coin" size={14} color={!canAfford ? Colors.coral : Colors.ink} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface FoodSelectorProps {
  credits: number;
  onFeed: (type: FoodType) => void;
  disabled?: boolean;
}

export function FoodSelector({ credits, onFeed, disabled }: FoodSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.creditsCard}>
        <Text style={styles.creditsLabel}>YOUR CREDITS</Text>
        <View style={styles.creditsValueRow}>
          <Text style={styles.creditsValue}>{credits} </Text>
          <ScottyIcon name="coin" size={20} color={Colors.coral} />
        </View>
      </View>
      <View style={styles.buttonsRow}>
        <FoodButton
          type="treat"
          name="Treat"
          cost={2}
          credits={credits}
          disabled={disabled}
          onPress={() => onFeed('treat')}
        />
        <FoodButton
          type="meal"
          name="Full Meal"
          cost={5}
          credits={credits}
          disabled={disabled}
          onPress={() => onFeed('meal')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  creditsCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    ...Shadows.sketchSm,
  },
  creditsLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.textMuted,
  },
  creditsValue: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.coral,
  },
  creditsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 120,
    borderWidth: 2,
    borderColor: Colors.ink,
    ...Shadows.sketch,
  },
  treatButton: {
    backgroundColor: Colors.stickyYellow,
    transform: [{ rotate: '-1deg' }],
  },
  mealButton: {
    backgroundColor: Colors.stickyGreen,
    transform: [{ rotate: '1deg' }],
  },
  disabledButton: {
    backgroundColor: Colors.paperDark,
    opacity: 0.5,
  },
  iconContainer: {
    marginBottom: 8,
  },
  name: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: 8,
  },
  disabledText: {
    color: Colors.textMuted,
  },
  costBadge: {
    backgroundColor: `${Colors.ink}10`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  insufficientBadge: {
    backgroundColor: `${Colors.coral}30`,
    borderColor: Colors.coral,
  },
  cost: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insufficientText: {
    color: Colors.coral,
  },
});

export default FoodSelector;
