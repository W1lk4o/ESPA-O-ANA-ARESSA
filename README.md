# ESPAÇO ANA ARESSA

Projeto simples, rápido e funcional para:
- cadastrar clientes
- cadastrar insumos e calcular custo por unidade
- cadastrar procedimentos
- lançar atendimentos
- calcular bruto, gastos e líquido
- alertar insumos acabando
- mostrar clientes sumidas com botão do WhatsApp
- instalar no iPhone pela tela inicial

## Instalação
```bash
npm install
```

## Banco no Supabase
1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Cole o arquivo `supabase/schema.sql`.
4. Execute.

## Ambiente
Crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

## Rodar local
```bash
npm run dev
```

## Subir no GitHub e Vercel
- suba o repositório no GitHub
- importe na Vercel
- adicione as duas variáveis de ambiente
- publique

## iPhone
Abra no Safari e use **Adicionar à Tela de Início**.

## Aviso importante
As policies do Supabase estão abertas para acelerar esta primeira versão.
Depois, o ideal é colocar login e fechar o acesso.
