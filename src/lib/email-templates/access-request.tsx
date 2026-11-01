import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';

function AccessRequest({ email = 'Usuario', reviewUrl = '' }: { email?: string; reviewUrl?: string }) {
  return <Html lang="es"><Head /><Preview>Nueva solicitud de acceso a Natación Pro</Preview><Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}><Container style={{ padding: '28px' }}><Heading>Natación Pro</Heading><Text>{email} solicita acceso al programa.</Text><Text>La cuenta no tiene acceso a los datos. Solo tú puedes aprobarla o rechazarla.</Text><Button href={reviewUrl}>Revisar solicitud</Button><Text>Al aprobar, otorgas acceso administrativo a los datos y herramientas de gestión.</Text></Container></Body></Html>;
}

export const template = { component: AccessRequest, subject: 'Solicitud de acceso — Natación Pro', displayName: 'Solicitud de acceso', previewData: { email: 'nadador@example.com', reviewUrl: 'https://lane-split-meetkeeper.lovable.app/access' } } satisfies TemplateEntry;