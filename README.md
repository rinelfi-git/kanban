# Kanban
Kanban est un projet personnel libre qui reprends le fonctionnement basique du gestionnaire de projet trello.
## Dépendances
Le projet dépend de :
- **jquery-2.1.2** ou une version supérieure
- **font awesome 4.7** ou une version supérieure  

C'est aussi simple que ça.
Mettez les fichiers tels qu'ils sont dans l'arborescence du projet.
```
    kanban
    |___kanban.css
    |___kanban.js
    |___language
        |__fr.json
        |__autres-fichiers-de-traductions.json
```
## Utilisation  
Créez un conteneur avec lequel vous aller attacher le kanban. Sans oublier que ceci est une extension jquery, donc il s'applique tout de suite à un objet jquery.  
**Exemple :**  
*HTML*
```html
<body>
    <div id="kanban"></div>
</body>
```
*JavaScript*
```JavaScript
$('#kanban').kanban(options)
```
Il faut tout de même noter que les options regroupent les paramètres d'initialisation ainsi que les callbacks des actions effectués ssur le kanban.  

| Option | Type | Description |  
| :----- |:---- | :---------- |
| headers | `{id: any, label: string}[]` | Liste d'objet indiquant la liste des conteneurs, comme **Todo** ou **Test** de la figure 1.<br>L'`id` soit être unique pour toutes les entêtes ; pour le `label` vous êtes libres de mettre ce que vous voulez |
| data | `{title: string, header: any}[]` | Une liste d'objet regroupant toutes les données à afficher par catégorie de conteneur. Le `title` indique simplement le texte à afficher alors que `header` fait la liaison à l'entête et permet de bien placer la donnée |

![todo, done](<Screenshot from 2023-08-11 21-53-15.png>)  
*figure 1*

