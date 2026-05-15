import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FlaskConical,
  Gauge,
  Leaf,
  Package,
  RotateCcw,
  ScanBarcode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Sprout,
  Tags,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getProductByBarcode,
  ProductNotFoundError,
} from '../services/productApi';
import type { AnalysisCardModel, AnalysisSeverity, ProductAnalysisResult } from '../types/product';

type ScreenPhase = 'idle' | 'scanning' | 'loading' | 'result' | 'error';

type BarcodeEvent = {
  data?: string;
};

type ErrorState = {
  title: string;
  message: string;
};

type IconProps = {
  color: string;
  size: number;
  strokeWidth?: number;
};

const FEATURE_TILES = [
  { label: 'Palm', icon: Sprout, accent: '#7CFFB2' },
  { label: 'Şeker', icon: Gauge, accent: '#F6C453' },
  { label: 'Alerjen', icon: ShieldCheck, accent: '#78D7FF' },
  { label: 'Katkı', icon: FlaskConical, accent: '#B6A0FF' },
  { label: 'Vegan', icon: Leaf, accent: '#8CFFCE' },
  { label: 'NOVA', icon: Package, accent: '#FF8A7A' },
];

const SEVERITY_TOKENS: Record<
  AnalysisSeverity,
  {
    label: string;
    color: string;
    background: string;
    border: string;
    glow: string;
  }
> = {
  good: {
    label: 'Temiz',
    color: '#7CFFB2',
    background: 'rgba(124, 255, 178, 0.1)',
    border: 'rgba(124, 255, 178, 0.35)',
    glow: 'rgba(124, 255, 178, 0.18)',
  },
  warning: {
    label: 'Dikkat',
    color: '#F6C453',
    background: 'rgba(246, 196, 83, 0.12)',
    border: 'rgba(246, 196, 83, 0.38)',
    glow: 'rgba(246, 196, 83, 0.18)',
  },
  danger: {
    label: 'Risk',
    color: '#FF6B6B',
    background: 'rgba(255, 107, 107, 0.12)',
    border: 'rgba(255, 107, 107, 0.4)',
    glow: 'rgba(255, 107, 107, 0.16)',
  },
  neutral: {
    label: 'Veri yok',
    color: '#AEB9C4',
    background: 'rgba(174, 185, 196, 0.1)',
    border: 'rgba(174, 185, 196, 0.24)',
    glow: 'rgba(174, 185, 196, 0.1)',
  },
};

const CARD_ICONS: Record<string, React.ComponentType<IconProps>> = {
  'palm-oil': Sprout,
  completeness: Gauge,
  sugar: Gauge,
  allergens: ShieldCheck,
  additives: FlaskConical,
  diet: Leaf,
  'nutri-score': Tags,
  nova: Package,
  ingredients: ClipboardList,
};

export function FoodFactsScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScreenPhase>('idle');
  const [product, setProduct] = useState<ProductAnalysisResult | undefined>();
  const [error, setError] = useState<ErrorState | undefined>();
  const [lastBarcode, setLastBarcode] = useState<string | undefined>();
  const scanLockRef = useRef(false);

  const resultSummary = useMemo(() => {
    if (!product) {
      return undefined;
    }

    const dangerCount = product.analysisCards.filter((card) => card.severity === 'danger').length;
    const warningCount = product.analysisCards.filter((card) => card.severity === 'warning').length;
    const missingCount = product.analysisCards.filter((card) => card.severity === 'neutral').length;

    if (dangerCount > 0) {
      return {
        label: 'Dikkatli incele',
        detail: `${dangerCount} kritik sinyal, ${warningCount} uyarı`,
        severity: 'danger' as const,
      };
    }

    if (warningCount > 0) {
      return {
        label: 'Kontrol önerilir',
        detail: `${warningCount} uyarı, ${missingCount} eksik veri`,
        severity: 'warning' as const,
      };
    }

    return {
      label: 'Sinyaller sakin',
      detail: `${missingCount} alanda veri eksik olabilir`,
      severity: 'good' as const,
    };
  }, [product]);

  const beginScan = async () => {
    setError(undefined);

    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const response = await requestPermission();

      if (!response.granted) {
        scanLockRef.current = false;
        setPhase('error');
        setError({
          title: 'Kamera izni gerekli',
          message: 'Kamera izni olmadan barkod taraması yapılamaz.',
        });
        return;
      }
    }

    scanLockRef.current = false;
    setPhase('scanning');
  };

  const cancelScan = () => {
    scanLockRef.current = false;
    setPhase(product ? 'result' : 'idle');
  };

  const resetProduct = () => {
    scanLockRef.current = false;
    setProduct(undefined);
    setError(undefined);
    setLastBarcode(undefined);
    setPhase('idle');
  };

  const handleBarcodeScanned = async ({ data }: BarcodeEvent) => {
    const barcode = data?.trim();

    if (!barcode || scanLockRef.current) {
      return;
    }

    scanLockRef.current = true;
    setLastBarcode(barcode);
    setPhase('loading');

    try {
      const nextProduct = await getProductByBarcode(barcode);
      setProduct(nextProduct);
      setError(undefined);
      setPhase('result');
    } catch (caughtError) {
      setProduct(undefined);
      setPhase('error');

      if (caughtError instanceof ProductNotFoundError) {
        setError({
          title: 'Ürün bulunamadı',
          message: 'Open Food Facts ve ek kaynaklar kontrol edildi, ürün bulunamadı.',
        });
        return;
      }

      setError({
        title: 'Ürün bilgisi alınamadı',
        message: 'Backend ürün çözümleyiciye ulaşırken bir sorun oluştu.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <ScanBarcode color="#07100D" size={22} strokeWidth={2.8} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandLabel}>Şeffaf Sepet</Text>
            <Text style={styles.brandName}>FoodFacts</Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Resolver</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.eyebrow}>
              <Sparkles color="#B6A0FF" size={15} strokeWidth={2.5} />
              <Text style={styles.eyebrowText}>Market içi ürün radarı</Text>
            </View>

            <Text style={styles.heroTitle}>Barkodu okut. Kaynakları tek tek gezsin.</Text>
            <Text style={styles.heroText}>
              Backend önce Open Food Facts’e bakar, eksik kalan alanlar için ek kaynak bağlayıcılarını kontrol eder.
            </Text>
          </View>

          <ScanConsole
            lastBarcode={lastBarcode}
            phase={phase}
            permissionReady={Boolean(permission)}
            onCancelScan={cancelScan}
            onScan={beginScan}
            onBarcodeScanned={handleBarcodeScanned}
          />
        </View>

        <View style={styles.featureGrid}>
          {FEATURE_TILES.map((tile) => {
            const Icon = tile.icon;

            return (
              <View key={tile.label} style={styles.featureTile}>
                <View style={[styles.featureIcon, { borderColor: `${tile.accent}55` }]}>
                  <Icon color={tile.accent} size={18} strokeWidth={2.4} />
                </View>
                <Text style={styles.featureLabel}>{tile.label}</Text>
              </View>
            );
          })}
        </View>

        {phase === 'error' && error ? (
          <InlineError
            error={error}
            onRetry={beginScan}
            onClear={resetProduct}
            hasPreviousProduct={Boolean(product)}
          />
        ) : null}

        {product ? (
          <View style={styles.resultSection}>
            <View style={styles.resultHeaderRow}>
              <View>
                <Text style={styles.sectionKicker}>Analiz sonucu</Text>
                <Text style={styles.sectionTitle}>Ürün sinyalleri</Text>
              </View>
              {resultSummary ? <SummaryBadge summary={resultSummary} /> : null}
            </View>

            <ProductShowcase product={product} />
            <SourceIntelPanel product={product} />

            <View style={styles.priorityStrip}>
              {product.analysisCards.slice(0, 4).map((card) => (
                <MiniSignal key={card.id} card={card} />
              ))}
            </View>

            <View style={styles.analysisGrid}>
              {product.analysisCards.map((card) => (
                <SignalCard key={card.id} card={card} />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={beginScan}
              style={({ pressed }) => [styles.secondaryScanButton, pressed && styles.pressed]}
            >
              <RotateCcw color="#07100D" size={20} strokeWidth={2.7} />
              <Text style={styles.secondaryScanText}>Yeni ürün tara</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <View style={styles.emptyIcon}>
              <Barcode color="#7CFFB2" size={30} strokeWidth={2.4} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Henüz ürün taranmadı</Text>
              <Text style={styles.emptyText}>
                Kamerayı aç, barkodu çerçevenin içine getir ve FoodFacts ürün sinyallerini çıkarsın.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type ScanConsoleProps = {
  phase: ScreenPhase;
  permissionReady: boolean;
  lastBarcode?: string;
  onScan: () => void;
  onCancelScan: () => void;
  onBarcodeScanned: (event: BarcodeEvent) => void;
};

function ScanConsole({
  phase,
  permissionReady,
  lastBarcode,
  onScan,
  onCancelScan,
  onBarcodeScanned,
}: ScanConsoleProps) {
  const isScanning = phase === 'scanning';
  const isLoading = phase === 'loading';

  return (
    <View style={styles.console}>
      <View style={styles.consoleHeader}>
        <View>
          <Text style={styles.consoleLabel}>Scan Engine</Text>
          <Text style={styles.consoleTitle}>
            {isScanning ? 'Kamera aktif' : isLoading ? 'Kaynaklar aranıyor' : 'Hazır'}
          </Text>
        </View>
        <View style={[styles.statusChip, isScanning && styles.statusChipActive]}>
          <View style={[styles.statusDot, isScanning && styles.statusDotActive]} />
          <Text style={styles.statusText}>{isScanning ? 'Live' : 'Standby'}</Text>
        </View>
      </View>

      <View style={styles.scanViewport}>
        {isScanning ? (
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'],
            }}
            facing="back"
            onBarcodeScanned={onBarcodeScanned}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.syntheticScanner}>
            <View style={styles.scanLens}>
              <ScanLine color="#7CFFB2" size={52} strokeWidth={1.9} />
            </View>
            <View style={styles.barcodePreview}>
              {[18, 7, 14, 5, 22, 10, 16, 6, 20, 9, 13, 5].map((width, index) => (
                <View
                  key={`${width}-${index}`}
                  style={[styles.fakeBarcodeLine, { width, opacity: index % 2 ? 0.48 : 0.82 }]}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.scanCorners} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>

        {isLoading ? (
          <View style={styles.loadingLayer}>
            <ActivityIndicator color="#7CFFB2" size="large" />
            <Text style={styles.loadingText}>Open Food Facts ve ek kaynaklar kontrol ediliyor...</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.consoleFooter}>
        <View style={styles.barcodeReadout}>
          <Barcode color="#7CFFB2" size={17} strokeWidth={2.4} />
          <Text style={styles.barcodeReadoutText}>{lastBarcode ?? 'Barkod bekleniyor'}</Text>
        </View>

        {isScanning ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCancelScan}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <X color="#F4F7F6" size={18} strokeWidth={2.7} />
            <Text style={styles.cancelButtonText}>Kapat</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!permissionReady || isLoading}
            onPress={onScan}
            style={({ pressed }) => [
              styles.primaryButton,
              (!permissionReady || isLoading) && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#07100D" />
            ) : (
              <Camera color="#07100D" size={21} strokeWidth={2.8} />
            )}
            <Text style={styles.primaryButtonText}>
              {permissionReady ? 'Barkod tara' : 'Kamera hazırlanıyor'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ProductShowcase({ product }: { product: ProductAnalysisResult }) {
  return (
    <View style={styles.productShowcase}>
      <View style={styles.productImageShell}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} resizeMode="cover" style={styles.productImage} />
        ) : (
          <View style={styles.productPlaceholder}>
            <Package color="#7CFFB2" size={42} strokeWidth={1.9} />
            <Text style={styles.productPlaceholderText}>FoodFacts</Text>
          </View>
        )}
      </View>

      <View style={styles.productCopy}>
        <Text style={styles.productMeta}>Ürün profili</Text>
        <Text style={styles.productName} numberOfLines={3}>
          {product.productName}
        </Text>
        {product.brand ? <Text style={styles.productBrand}>{product.brand}</Text> : null}
        <View style={styles.productBarcodePill}>
          <Barcode color="#AEB9C4" size={16} strokeWidth={2.4} />
          <Text style={styles.productBarcodeText}>{product.barcode}</Text>
        </View>
      </View>
    </View>
  );
}

function SourceIntelPanel({ product }: { product: ProductAnalysisResult }) {
  const sourceFields = [
    { label: 'Ürün adı', source: product.sources.productName },
    { label: 'İçindekiler', source: product.sources.ingredientsText },
    { label: 'Besin değeri', source: product.sources.nutrition },
    { label: 'Alerjen', source: product.sources.allergens },
    { label: 'Katkı', source: product.sources.additives },
    { label: 'NOVA', source: product.sources.novaGroup },
  ].filter((item) => item.source);
  const missingLabels = [
    !product.completeness.hasIngredients ? 'içindekiler' : undefined,
    !product.completeness.hasNutrition ? 'besin değeri' : undefined,
    !product.completeness.hasAllergens ? 'alerjen' : undefined,
    !product.completeness.hasAdditives ? 'katkı' : undefined,
  ].filter((item): item is string => Boolean(item));

  return (
    <View style={styles.sourcePanel}>
      <View style={styles.sourceTopRow}>
        <View style={styles.completenessMeter}>
          <Text style={styles.completenessScore}>{product.completeness.score}</Text>
          <Text style={styles.completenessSuffix}>/100</Text>
        </View>
        <View style={styles.sourceIntro}>
          <Text style={styles.sourceTitle}>Kaynaklar kontrol edildi</Text>
          <Text style={styles.sourceText}>
            {product.sources.cacheHit
              ? 'Bu ürün yerel cache üzerinden hızlıca getirildi.'
              : 'Backend Open Food Facts ve ek kaynak bağlayıcılarını sırayla denedi.'}
          </Text>
        </View>
      </View>

      {sourceFields.length ? (
        <View style={styles.sourceChipGrid}>
          {sourceFields.map((item) => (
            <View key={`${item.label}-${item.source}`} style={styles.sourceChip}>
              <Text style={styles.sourceChipLabel}>{item.label}</Text>
              <Text style={styles.sourceChipValue}>{item.source}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.checkList}>
        {product.sources.checked.map((check, index) => (
          <View key={`${check.sourceName}-${index}`} style={styles.checkRow}>
            <View
              style={[
                styles.checkDot,
                check.status === 'hit' || check.status === 'cache'
                  ? styles.checkDotHit
                  : check.status === 'error'
                    ? styles.checkDotError
                    : styles.checkDotMiss,
              ]}
            />
            <Text style={styles.checkSource}>{check.sourceName}</Text>
            <Text style={styles.checkStatus}>{formatSourceStatus(check.status)}</Text>
          </View>
        ))}
      </View>

      {missingLabels.length ? (
        <View style={styles.ocrPanel}>
          <View style={styles.ocrIcon}>
            <Camera color="#07100D" size={20} strokeWidth={2.7} />
          </View>
          <View style={styles.ocrCopy}>
            <Text style={styles.ocrTitle}>Bazı bilgiler eksik</Text>
            <Text style={styles.ocrText}>
              Eksik alanlar: {missingLabels.join(', ')}. İstersen ambalajın içindekiler kısmını fotoğraflayabilirsin.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Alert.alert('OCR hazırlığı', 'İçindekiler fotoğrafı okuma akışı sonraki adım için hazırlandı.');
            }}
            style={({ pressed }) => [styles.ocrButton, pressed && styles.pressed]}
          >
            <Text style={styles.ocrButtonText}>Fotoğraf çek</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MiniSignal({ card }: { card: AnalysisCardModel }) {
  const token = SEVERITY_TOKENS[card.severity];
  const Icon = CARD_ICONS[card.id] ?? CircleAlert;

  return (
    <View style={[styles.miniSignal, { borderColor: token.border, backgroundColor: token.background }]}>
      <Icon color={token.color} size={18} strokeWidth={2.5} />
      <Text style={styles.miniSignalTitle} numberOfLines={1}>
        {card.title}
      </Text>
      <Text style={[styles.miniSignalValue, { color: token.color }]} numberOfLines={1}>
        {card.value}
      </Text>
    </View>
  );
}

function formatSourceStatus(status: 'hit' | 'miss' | 'error' | 'skipped' | 'cache'): string {
  if (status === 'hit') {
    return 'Buldu';
  }

  if (status === 'cache') {
    return 'Cache';
  }

  if (status === 'error') {
    return 'Hata';
  }

  if (status === 'skipped') {
    return 'Atlandı';
  }

  return 'Boş';
}

function SignalCard({ card }: { card: AnalysisCardModel }) {
  const token = SEVERITY_TOKENS[card.severity];
  const Icon = CARD_ICONS[card.id] ?? CircleAlert;
  const StatusIcon =
    card.severity === 'good'
      ? CheckCircle2
      : card.severity === 'danger'
        ? TriangleAlert
        : card.severity === 'warning'
          ? AlertCircle
          : CircleAlert;

  return (
    <View style={[styles.signalCard, { borderColor: token.border, backgroundColor: token.background }]}>
      <View style={[styles.cardGlow, { backgroundColor: token.glow }]} />
      <View style={styles.signalCardHeader}>
        <View style={[styles.signalIcon, { borderColor: token.border }]}>
          <Icon color={token.color} size={24} strokeWidth={2.3} />
        </View>
        <View style={styles.signalTitleBlock}>
          <Text style={styles.signalTitle}>{card.title}</Text>
          <Text style={styles.signalStatus}>{token.label}</Text>
        </View>
        <StatusIcon color={token.color} size={22} strokeWidth={2.5} />
      </View>

      <Text style={[styles.signalValue, { color: token.color }]}>{card.value}</Text>
      <Text style={styles.signalDescription}>{card.description}</Text>
    </View>
  );
}

function SummaryBadge({
  summary,
}: {
  summary: { label: string; detail: string; severity: Exclude<AnalysisSeverity, 'neutral'> };
}) {
  const token = SEVERITY_TOKENS[summary.severity];

  return (
    <View style={[styles.summaryBadge, { borderColor: token.border, backgroundColor: token.background }]}>
      <Text style={[styles.summaryLabel, { color: token.color }]}>{summary.label}</Text>
      <Text style={styles.summaryDetail}>{summary.detail}</Text>
    </View>
  );
}

function InlineError({
  error,
  onRetry,
  onClear,
  hasPreviousProduct,
}: {
  error: ErrorState;
  onRetry: () => void;
  onClear: () => void;
  hasPreviousProduct: boolean;
}) {
  return (
    <View style={styles.errorPanel}>
      <View style={styles.errorIcon}>
        <TriangleAlert color="#FF6B6B" size={25} strokeWidth={2.5} />
      </View>
      <View style={styles.errorCopy}>
        <Text style={styles.errorTitle}>{error.title}</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <View style={styles.errorActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [styles.errorButton, pressed && styles.pressed]}
          >
            <ScanBarcode color="#07100D" size={17} strokeWidth={2.6} />
            <Text style={styles.errorButtonText}>Tekrar tara</Text>
          </Pressable>
          {hasPreviousProduct ? (
            <Pressable
              accessibilityRole="button"
              onPress={onClear}
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
            >
              <Text style={styles.ghostButtonText}>Temizle</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07100D',
    paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight : 0,
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 34,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#7CFFB2',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  brandCopy: {
    flex: 1,
  },
  brandLabel: {
    color: '#8AA198',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  brandName: {
    color: '#F4F7F6',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 255, 178, 0.1)',
    borderColor: 'rgba(124, 255, 178, 0.25)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveDot: {
    backgroundColor: '#7CFFB2',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  liveText: {
    color: '#C8F7DC',
    fontSize: 12,
    fontWeight: '900',
  },
  hero: {
    gap: 16,
  },
  heroCopy: {
    gap: 12,
    paddingTop: 6,
  },
  eyebrow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(182, 160, 255, 0.11)',
    borderColor: 'rgba(182, 160, 255, 0.28)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  eyebrowText: {
    color: '#DAD0FF',
    fontSize: 12,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#F4F7F6',
    fontSize: 39,
    fontWeight: '900',
    lineHeight: 43,
  },
  heroText: {
    color: '#AEB9C4',
    fontSize: 16,
    lineHeight: 23,
  },
  console: {
    backgroundColor: '#0D1713',
    borderColor: 'rgba(124, 255, 178, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  consoleHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  consoleLabel: {
    color: '#6F867D',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  consoleTitle: {
    color: '#F4F7F6',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  statusChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(174, 185, 196, 0.1)',
    borderColor: 'rgba(174, 185, 196, 0.22)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusChipActive: {
    backgroundColor: 'rgba(124, 255, 178, 0.12)',
    borderColor: 'rgba(124, 255, 178, 0.35)',
  },
  statusDot: {
    backgroundColor: '#7A8793',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusDotActive: {
    backgroundColor: '#7CFFB2',
  },
  statusText: {
    color: '#F4F7F6',
    fontSize: 12,
    fontWeight: '900',
  },
  scanViewport: {
    aspectRatio: 1.45,
    backgroundColor: '#111D18',
    overflow: 'hidden',
  },
  syntheticScanner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLens: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 255, 178, 0.08)',
    borderColor: 'rgba(124, 255, 178, 0.24)',
    borderRadius: 8,
    borderWidth: 1,
    height: 106,
    justifyContent: 'center',
    width: 106,
  },
  barcodePreview: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    height: 54,
    marginTop: 20,
  },
  fakeBarcodeLine: {
    backgroundColor: '#E9FFF3',
    borderRadius: 2,
    height: '100%',
  },
  scanCorners: {
    ...StyleSheet.absoluteFillObject,
    margin: 18,
  },
  corner: {
    borderColor: '#7CFFB2',
    height: 34,
    position: 'absolute',
    width: 34,
  },
  cornerTopLeft: {
    borderLeftWidth: 3,
    borderTopWidth: 3,
    left: 0,
    top: 0,
  },
  cornerTopRight: {
    borderRightWidth: 3,
    borderTopWidth: 3,
    right: 0,
    top: 0,
  },
  cornerBottomLeft: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    bottom: 0,
    right: 0,
  },
  loadingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 16, 13, 0.86)',
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#F4F7F6',
    fontSize: 15,
    fontWeight: '800',
  },
  consoleFooter: {
    gap: 12,
    padding: 14,
  },
  barcodeReadout: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  barcodeReadoutText: {
    color: '#B7C6BF',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7CFFB2',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#07100D',
    fontSize: 17,
    fontWeight: '900',
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: '#F4F7F6',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    gap: 9,
    minHeight: 92,
    justifyContent: 'center',
    padding: 12,
  },
  featureIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  featureLabel: {
    color: '#F4F7F6',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultSection: {
    gap: 14,
    marginTop: 2,
  },
  resultHeaderRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionKicker: {
    color: '#7CFFB2',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#F4F7F6',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  summaryBadge: {
    alignItems: 'flex-end',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 150,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  summaryDetail: {
    color: '#AEB9C4',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'right',
  },
  productShowcase: {
    backgroundColor: '#101B17',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 12,
  },
  productImageShell: {
    backgroundColor: '#EAF2EE',
    borderColor: 'rgba(124, 255, 178, 0.32)',
    borderRadius: 8,
    borderWidth: 1,
    height: 116,
    overflow: 'hidden',
    width: 116,
  },
  productImage: {
    height: '100%',
    width: '100%',
  },
  productPlaceholder: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  productPlaceholderText: {
    color: '#0D1713',
    fontSize: 12,
    fontWeight: '900',
  },
  productCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  productMeta: {
    color: '#7CFFB2',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  productName: {
    color: '#F4F7F6',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 27,
    marginTop: 5,
  },
  productBrand: {
    color: '#B6A0FF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  productBarcodePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  productBarcodeText: {
    color: '#D7E1DC',
    fontSize: 12,
    fontWeight: '800',
  },
  sourcePanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderColor: 'rgba(120, 215, 255, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 13,
    padding: 14,
  },
  sourceTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
  },
  completenessMeter: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 255, 178, 0.1)',
    borderColor: 'rgba(124, 255, 178, 0.36)',
    borderRadius: 8,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  completenessScore: {
    color: '#7CFFB2',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 29,
  },
  completenessSuffix: {
    color: '#AEB9C4',
    fontSize: 12,
    fontWeight: '900',
  },
  sourceIntro: {
    flex: 1,
  },
  sourceTitle: {
    color: '#F4F7F6',
    fontSize: 18,
    fontWeight: '900',
  },
  sourceText: {
    color: '#AEB9C4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  sourceChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '30%',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  sourceChipLabel: {
    color: '#7A8793',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sourceChipValue: {
    color: '#E8F1ED',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },
  checkList: {
    gap: 7,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  checkDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  checkDotHit: {
    backgroundColor: '#7CFFB2',
  },
  checkDotMiss: {
    backgroundColor: '#7A8793',
  },
  checkDotError: {
    backgroundColor: '#FF6B6B',
  },
  checkSource: {
    color: '#D7E1DC',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  checkStatus: {
    color: '#AEB9C4',
    fontSize: 12,
    fontWeight: '900',
  },
  ocrPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(246, 196, 83, 0.11)',
    borderColor: 'rgba(246, 196, 83, 0.32)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 11,
  },
  ocrIcon: {
    alignItems: 'center',
    backgroundColor: '#F6C453',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  ocrCopy: {
    flex: 1,
  },
  ocrTitle: {
    color: '#F4F7F6',
    fontSize: 14,
    fontWeight: '900',
  },
  ocrText: {
    color: '#E5D2A5',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  ocrButton: {
    alignItems: 'center',
    backgroundColor: '#F6C453',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 10,
  },
  ocrButtonText: {
    color: '#07100D',
    fontSize: 12,
    fontWeight: '900',
  },
  priorityStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniSignal: {
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 7,
    minHeight: 96,
    padding: 12,
  },
  miniSignalTitle: {
    color: '#F4F7F6',
    fontSize: 13,
    fontWeight: '900',
  },
  miniSignalValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  analysisGrid: {
    gap: 12,
  },
  signalCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
  },
  cardGlow: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  signalCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  signalIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  signalTitleBlock: {
    flex: 1,
  },
  signalTitle: {
    color: '#F4F7F6',
    fontSize: 18,
    fontWeight: '900',
  },
  signalStatus: {
    color: '#AEB9C4',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  signalValue: {
    fontSize: 23,
    fontWeight: '900',
    marginTop: 14,
  },
  signalDescription: {
    color: '#C4CEC9',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  secondaryScanButton: {
    alignItems: 'center',
    backgroundColor: '#7CFFB2',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  secondaryScanText: {
    color: '#07100D',
    fontSize: 17,
    fontWeight: '900',
  },
  emptyPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 255, 178, 0.08)',
    borderColor: 'rgba(124, 255, 178, 0.22)',
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: '#F4F7F6',
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: '#AEB9C4',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  errorPanel: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: 'rgba(255, 107, 107, 0.34)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 14,
  },
  errorIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  errorCopy: {
    flex: 1,
  },
  errorTitle: {
    color: '#F4F7F6',
    fontSize: 18,
    fontWeight: '900',
  },
  errorMessage: {
    color: '#F0C7C7',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 13,
  },
  errorButton: {
    alignItems: 'center',
    backgroundColor: '#FFB4A8',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  errorButtonText: {
    color: '#07100D',
    fontSize: 14,
    fontWeight: '900',
  },
  ghostButton: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    color: '#F4F7F6',
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.82,
  },
});
