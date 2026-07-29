import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getDocuments } from '../api';

export default function DocumentListScreen({ navigation }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      try {
        const result = await getDocuments();
        setDocuments(result.documents || []);
      } catch (err) {
        console.error('Failed to load documents:', err);
        setError(err?.message || 'Unable to load documents');
        Alert.alert('Documents unavailable', err?.message || 'Unable to load documents.');
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(documents.map((doc) => doc.category).filter(Boolean));
    return ['all', ...Array.from(unique)];
  }, [documents]);

  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    const queryText = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesCategory = category === 'all' || doc.category === category;
      const matchesQuery = !queryText || [doc.title, doc.description, doc.category, doc.subcategory, ...(doc.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(queryText);
      return matchesCategory && matchesQuery;
    });
  }, [documents, query, category]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DocumentDetail', { documentId: item.id, title: item.title })}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{item.category}</Text>
        <Text style={styles.meta}>{item.subcategory}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0077cc" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Unable to load documents.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Document Portal</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search documents"
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.categoryRow}>
        {categories.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.categoryButton, category === item && styles.categoryButtonActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No documents match your search.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef5ff',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef5ff',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d9e8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d9e8',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#0077cc',
    borderColor: '#0077cc',
  },
  categoryText: {
    color: '#102a43',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0d3b66',
    marginBottom: 6,
  },
  description: {
    color: '#334e68',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: '#607d98',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    color: '#334e68',
    fontSize: 16,
  },
  error: {
    color: '#cc3300',
    fontSize: 16,
  },
});
