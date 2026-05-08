const fs = require('fs');

let content = fs.readFileSync('c:/Users/nurbo/.gemini/antigravity/scratch/yamazumi/frontend/src/components/LabelEditor.tsx', 'utf8');

// Remove imports
content = content.replace(/import \{ supabase \} from "@\/integrations\/supabase\/client";\s*/g, '');
content = content.replace(/import \{ useAuth \} from "@\/hooks\/useAuth";\s*/g, '');

// Remove SavedTemplate interface
content = content.replace(/interface SavedTemplate \{[\s\S]*?\}\s*/g, '');

// Inside component:
content = content.replace(/const \[savedTemplates, setSavedTemplates\] = useState<SavedTemplate\[\]>\(\[\]\);\s*/g, '');
content = content.replace(/const \[saveDialogOpen, setSaveDialogOpen\] = useState\(false\);\s*/g, '');
content = content.replace(/const \[templateName, setTemplateName\] = useState\(""\);\s*/g, '');
content = content.replace(/const \{ user \} = useAuth\(\);\s*/g, '');

// Remove fetchTemplates and useEffect
content = content.replace(/const fetchTemplates = useCallback\([\s\S]*?\}, \[user\]\);\s*useEffect\(\(\) => \{\s*fetchTemplates\(\);\s*\}, \[fetchTemplates\]\);\s*/g, '');

// Remove Template handlers
content = content.replace(/const handleSaveTemplate = async \(\) => \{[\s\S]*?\};\s*/g, '');
content = content.replace(/const handleLoadTemplate = \(template: SavedTemplate\) => \{[\s\S]*?\};\s*/g, '');
content = content.replace(/const handleDeleteTemplate = async \(id: string\) => \{[\s\S]*?\};\s*/g, '');

// Update importTemplateFromFile
content = content.replace(
  /const template = await importTemplateFromFile\(file\);\s*onChange\(JSON\.parse\(JSON\.stringify\(template\.layout\)\)\);\s*\/\/ Also save imported template to DB[\s\S]*?toast\.success/g,
  `const template = await importTemplateFromFile(file);\n      onChange(JSON.parse(JSON.stringify(template.layout)));\n      toast.success`
);

// Fix UI elements
// Remove save button
content = content.replace(/<Button variant="ghost" size="sm" onClick=\{\(\) => setSaveDialogOpen\(true\)\} className="text-xs" title="Сохранить шаблон">[\s\S]*?<\/Button>\s*/g, '');

// Remove Save dialog
content = content.replace(/\{\/\* Save dialog \*\/\}[\s\S]*?\{\/\* Saved templates \*\/\}/, '{/* Saved templates */}');

// Remove Saved templates block
content = content.replace(/\{\/\* Saved templates \*\/\}[\s\S]*?\{\/\* Preset templates \*\/\}/, '{/* Preset templates */}');

// Fix types
content = content.replace(/\{LABEL_PRESETS\.map\(\(preset\) => \(/g, '{LABEL_PRESETS.map((preset: any) => (');
content = content.replace(/onCheckedChange=\{\(c\) =>/g, 'onCheckedChange={(c: boolean) =>');

fs.writeFileSync('c:/Users/nurbo/.gemini/antigravity/scratch/yamazumi/frontend/src/components/LabelEditor.tsx', content);
console.log('Fixed LabelEditor.tsx');
