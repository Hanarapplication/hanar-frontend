import type { ProfileTemplateId } from '../theme/tokens';
import { BrandTemplate } from './BrandTemplate';
import { SellTemplate } from './SellTemplate';
import { PrestigeTemplate } from './PrestigeTemplate';
import { ServiceTemplate } from './ServiceTemplate';
import { SimpleTemplate } from './SimpleTemplate';
import type { BusinessProfileRendererProps } from '../ProfileProps';

const TEMPLATES: Record<ProfileTemplateId, React.ComponentType<BusinessProfileRendererProps>> = {
  brand: BrandTemplate,
  sell: SellTemplate,
  prestige: PrestigeTemplate,
  service: ServiceTemplate,
  simple: SimpleTemplate,
};

export function getProfileTemplate(
  templateId: ProfileTemplateId
): React.ComponentType<BusinessProfileRendererProps> {
  return TEMPLATES[templateId] ?? TEMPLATES.brand;
}

export { BrandTemplate, SellTemplate, PrestigeTemplate, ServiceTemplate, SimpleTemplate };
