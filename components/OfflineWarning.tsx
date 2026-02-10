import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function OfflineWarning() {
    const [isConnected, setIsConnected] = useState(true);
    const [animation] = useState(new Animated.Value(-100)); // Start hidden above

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const status = await Network.getNetworkStateAsync();
                const connected = status.isConnected ?? false;
                setIsConnected(connected);
            } catch (e) {
                console.log('Network check failed', e);
            }
        };

        // Initial check
        checkConnection();

        // Unfortunately expo-network doesn't have a direct listener hook that works perfectly across all versions/platforms instantly,
        // but we can check periodically or on app state change. 
        // However, best practice often involves polling or using NetInfo from react-native-community if deeper integration is needed.
        // effective-connection-type is available in expo-network.

        // For this implementation, we will check on mount and interval.
        const interval = setInterval(checkConnection, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, []);

    // Trigger animation when state changes
    useEffect(() => {
        Animated.timing(animation, {
            toValue: isConnected ? -100 : 0, // Hide (-100) if online, Show (0) if offline
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isConnected]);

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: animation }] }]}>
            <View style={styles.content}>
                <Ionicons name="cloud-offline" size={20} color="white" />
                <Text style={styles.text}>Anda sedang offline. Periksa koneksi internet Anda.</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50, // Adjust based on header height or safe area
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        backgroundColor: '#ef4444', // Red-500
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    text: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
});
