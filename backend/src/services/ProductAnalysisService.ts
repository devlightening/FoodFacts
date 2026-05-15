import type {
  AnalysisCardModel,
  AnalysisSeverity,
  ProductAnalysisResult,
} from '../models/ProductAnalysisResult.js';
import type { MergedProduct } from './ProductMergeService.js';
import { detectPalmOil } from '../utils/detectPalmOil.js';

export class ProductAnalysisService {
  analyze(product: MergedProduct): ProductAnalysisResult {
    return {
      ...product,
      analysisCards: [
        this.analyzeCompleteness(product),
        this.analyzePalmOil(product),
        this.analyzeSugar(product),
        this.analyzeAllergens(product),
        this.analyzeAdditives(product),
        this.analyzeDiet(product),
        this.analyzeNutriScore(product),
        this.analyzeNova(product),
        this.analyzeIngredients(product),
      ],
    };
  }

  private analyzeCompleteness(product: MergedProduct): AnalysisCardModel {
    const score = product.completeness.score;

    if (score >= 80) {
      return card(
        'completeness',
        'Veri Tamlığı',
        `${score}/100`,
        'Ürün bilgisi yeterli seviyede. Kaynaklar kontrol edildi.',
        'good',
      );
    }

    if (score >= 45) {
      return card(
        'completeness',
        'Veri Tamlığı',
        `${score}/100`,
        'Bazı bilgiler eksik. Ek kaynaklar kontrol edildi.',
        'warning',
      );
    }

    return card(
      'completeness',
      'Veri Tamlığı',
      `${score}/100`,
      'Bu ürün için önemli bilgiler eksik. İçindekiler fotoğrafı gerekebilir.',
      'neutral',
    );
  }

  private analyzePalmOil(product: MergedProduct): AnalysisCardModel {
    const palmOil = detectPalmOil(product);

    if (palmOil === 'unknown') {
      return card(
        'palm-oil',
        'Palm Yağı',
        'Bilgi yok',
        'Kaynaklarda palm yağı kontrolü için yeterli içerik verisi bulunamadı.',
        'neutral',
      );
    }

    if (palmOil === 'detected') {
      return card(
        'palm-oil',
        'Palm Yağı',
        'Var olabilir',
        'İçerik veya etiket verisinde palm yağına işaret eden ifade bulundu.',
        'warning',
      );
    }

    return card(
      'palm-oil',
      'Palm Yağı',
      'Tespit edilmedi',
      'Birleştirilen kaynak verilerinde palm yağı ifadesi bulunmadı.',
      'good',
    );
  }

  private analyzeSugar(product: MergedProduct): AnalysisCardModel {
    const sugar = product.nutrition?.sugars100g;

    if (sugar === undefined) {
      return card('sugar', 'Şeker', 'Bilgi yok', '100 gramdaki şeker değeri bulunamadı.', 'neutral');
    }

    if (sugar >= 22.5) {
      return card('sugar', 'Şeker', 'Yüksek', `${formatGram(sugar)}. Bu tıbbi öneri değildir.`, 'danger');
    }

    if (sugar >= 5) {
      return card('sugar', 'Şeker', 'Orta', `${formatGram(sugar)}. Bu tıbbi öneri değildir.`, 'warning');
    }

    return card('sugar', 'Şeker', 'Düşük', `${formatGram(sugar)}. Bu tıbbi öneri değildir.`, 'good');
  }

  private analyzeAllergens(product: MergedProduct): AnalysisCardModel {
    if (!product.allergens) {
      return card('allergens', 'Alerjenler', 'Bilgi yok', 'Alerjen verisi hiçbir kaynakta bulunamadı.', 'neutral');
    }

    if (product.allergens.length === 0) {
      return card('allergens', 'Alerjenler', 'Belirtilen alerjen yok', 'Kaynaklarda bildirilen alerjen yok.', 'good');
    }

    return card(
      'allergens',
      'Alerjenler',
      'Alerjen içeriyor',
      `${product.allergens.length} alerjen bildirildi: ${formatList(product.allergens)}.`,
      'danger',
    );
  }

  private analyzeAdditives(product: MergedProduct): AnalysisCardModel {
    if (!product.additives) {
      return card('additives', 'Katkı Maddeleri', 'Bilgi yok', 'Katkı maddesi verisi bulunamadı.', 'neutral');
    }

    if (product.additives.length === 0) {
      return card('additives', 'Katkı Maddeleri', 'Yok', 'Kaynaklarda katkı maddesi listelenmemiş.', 'good');
    }

    if (product.additives.length <= 2) {
      return card('additives', 'Katkı Maddeleri', `${product.additives.length} adet`, 'Az sayıda katkı maddesi bildirildi.', 'warning');
    }

    return card('additives', 'Katkı Maddeleri', `${product.additives.length} adet`, 'Birden fazla katkı maddesi bildirildi.', 'danger');
  }

  private analyzeDiet(product: MergedProduct): AnalysisCardModel {
    const tags = new Set(product.dietaryTags?.map((tag) => tag.toLowerCase()));

    if (!tags.size) {
      return card('diet', 'Vegan / Vejetaryen', 'Bilgi yok', 'Uygunluk verisi kaynaklarda net değil.', 'neutral');
    }

    if (tags.has('en:non-vegan')) {
      return card('diet', 'Vegan / Vejetaryen', 'Vegan değil', 'İçerik analizi vegan uygunluğu olmadığını gösteriyor.', 'danger');
    }

    if (tags.has('en:vegan')) {
      return card('diet', 'Vegan / Vejetaryen', 'Vegan', 'İçerik analizi vegan uygunluğuna işaret ediyor.', 'good');
    }

    if (tags.has('en:maybe-vegan')) {
      return card('diet', 'Vegan / Vejetaryen', 'Vegan olabilir', 'Veri kesin değil, içerik kontrolü önerilir.', 'warning');
    }

    if (tags.has('en:non-vegetarian')) {
      return card('diet', 'Vegan / Vejetaryen', 'Vejetaryen değil', 'İçerik analizi vejetaryen uygunluğu olmadığını gösteriyor.', 'danger');
    }

    if (tags.has('en:vegetarian')) {
      return card('diet', 'Vegan / Vejetaryen', 'Vejetaryen', 'İçerik analizi vejetaryen uygunluğuna işaret ediyor.', 'good');
    }

    return card('diet', 'Vegan / Vejetaryen', 'Bilgi yok', 'Uygunluk verisi ürün kaydında net değil.', 'neutral');
  }

  private analyzeNutriScore(product: MergedProduct): AnalysisCardModel {
    const grade = product.nutriScore?.toLowerCase();

    if (!grade || !['a', 'b', 'c', 'd', 'e'].includes(grade)) {
      return card('nutri-score', 'Nutri-Score', 'Bilgi yok', 'Nutri-Score bilgisi bulunamadı.', 'neutral');
    }

    const severity: Record<string, AnalysisSeverity> = {
      a: 'good',
      b: 'good',
      c: 'warning',
      d: 'warning',
      e: 'danger',
    };

    return card('nutri-score', 'Nutri-Score', grade.toUpperCase(), 'Genel besin profili göstergesi.', severity[grade]);
  }

  private analyzeNova(product: MergedProduct): AnalysisCardModel {
    const novaGroup = product.novaGroup;

    if (!novaGroup || novaGroup < 1 || novaGroup > 4) {
      return card('nova', 'NOVA Grubu', 'Bilgi yok', 'İşlenmişlik grubu bulunamadı.', 'neutral');
    }

    const severity: Record<number, AnalysisSeverity> = {
      1: 'good',
      2: 'good',
      3: 'warning',
      4: 'danger',
    };

    const descriptions: Record<number, string> = {
      1: 'Az işlenmiş veya işlenmemiş gıda sınıfı.',
      2: 'Mutfakta kullanılan işlenmiş bileşen sınıfı.',
      3: 'İşlenmiş gıda sınıfı; etiketi kontrol etmek iyi olur.',
      4: 'Ultra işlenmiş gıda sınıfı; içerik listesini dikkatle incelemek iyi olur.',
    };

    return card('nova', 'NOVA Grubu', `Grup ${novaGroup}`, descriptions[novaGroup], severity[novaGroup]);
  }

  private analyzeIngredients(product: MergedProduct): AnalysisCardModel {
    if (!product.ingredientsText) {
      return card('ingredients', 'İçindekiler', 'Bilgi yok', 'İçerik metni hiçbir kaynakta bulunamadı.', 'neutral');
    }

    return card('ingredients', 'İçindekiler', 'Bulundu', compact(product.ingredientsText), 'good');
  }
}

function card(
  id: string,
  title: string,
  value: string,
  description: string,
  severity: AnalysisSeverity,
): AnalysisCardModel {
  return {
    id,
    title,
    value,
    description,
    severity,
    icon: id,
  };
}

function formatGram(value: number): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
  return `${rounded} g / 100 g`;
}

function formatList(values: string[]): string {
  const visible = values.slice(0, 4).join(', ');
  const rest = values.length - 4;
  return rest > 0 ? `${visible} +${rest}` : visible;
}

function compact(value: string): string {
  return value.length > 220 ? `${value.slice(0, 219).trim()}…` : value;
}
