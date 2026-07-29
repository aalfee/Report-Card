import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { getDocumentById } from '../api';

export default function DocumentDetailScreen({ route, navigation }) {
  const { documentId, title } = route.params || {};
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      try {
        const result = await getDocumentById(documentId);
        setDocument(result.document);
        setContent(result.content || '');
      } catch (err) {
        console.error('Error loading document:', err);
        Alert.alert('Unable to load document', err?.message || 'Please try again later.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    loadDocument();
  }, [documentId, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0077cc" />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Document not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>{document.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{document.category}</Text>
        <Text style={styles.meta}>{document.subcategory}</Text>
      </View>
      <Text style={styles.description}>{document.description}</Text>
      <Text style={styles.documentText}>{content}</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Back to documents</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef5ff',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef5ff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0d3b66',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  meta: {
    color: '#607d98',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    marginBottom: 18,
    color: '#334e68',
    lineHeight: 22,
  },
  documentText: {
    color: '#102a43',
    lineHeight: 24,
    fontSize: 16,
  },
  backButton: {
    marginTop: 28,
    backgroundColor: '#0077cc',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  backText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  error: {
    color: '#cc3300',
    fontSize: 16,
  },
});
