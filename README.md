# Lane Split Meetkeeper

partiendo de un programa de natación llamado Meet manager y copiando, adaptando y mejorando su sistema deseo realizar un programa que pueda asimilar su ecosistema incluyendo las archivos que genera y se crean en el mismo partiendo de la siguiente estructura 

Para que tu nuevo sistema pueda recibir los archivos de Team Manager sin perder ningún dato, estas son las tablas principales que debes diseñar (ideal para PostgreSQL / Supabase):

⁠athletes⁠: ⁠id⁠, ⁠tm_athlete_id⁠ (ID interno de Hy-Tek para evitar duplicados al importar), ⁠federation_id⁠, ⁠first_name⁠, ⁠last_name⁠, ⁠birth_date⁠, ⁠gender⁠, ⁠group_id⁠, ⁠active_status⁠.

⁠meets⁠: ⁠id⁠, ⁠name⁠, ⁠location⁠, ⁠start_date⁠, ⁠end_date⁠, ⁠course⁠ (⁠LCM⁠ o ⁠SCM⁠), ⁠altitude⁠.

⁠events⁠: ⁠id⁠, ⁠meet_id⁠, ⁠event_number⁠, ⁠distance⁠, ⁠stroke⁠ (1=Libre, 2=Espalda, 3=Pecho, 4=Mariposa, 5=CI), ⁠gender⁠, ⁠min_age⁠, ⁠max_age⁠.

⁠results⁠: ⁠id⁠, ⁠athlete_id⁠, ⁠meet_id⁠, ⁠event_id⁠, ⁠seed_time_ms⁠, ⁠final_time_ms⁠ (guardar siempre los tiempos en milisegundos o centésimas enteras facilita todos los cálculos matemáticos y gráficas), ⁠course⁠, ⁠place⁠, ⁠aqua_points⁠, ⁠is_dq⁠ (descalificado), ⁠video_url⁠, ⁠stroke_rate⁠.

⁠splits⁠: ⁠id⁠, ⁠result_id⁠, ⁠split_distance⁠ (50, 100, 150...), ⁠cumulative_time_ms⁠, ⁠lap_time_ms⁠ (tiempo diferencial de ese parcial).

⁠time_standards⁠: ⁠id⁠, ⁠name⁠ (ej. "Mínimas Nacional por Categorías 2026"), ⁠gender⁠, ⁠age_group⁠, ⁠distance⁠, ⁠stroke⁠, ⁠course⁠, ⁠qualifying_time_ms⁠.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lane-split-meetkeeper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c92bb585-cf7c-4143-8d29-46d36e0f410d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
