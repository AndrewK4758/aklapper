export default function mergeCssClasses(class1: string | undefined, class2: string | undefined): string {
  return class1 && class2 ? ` ${class1} ${class2}` : class1 && !class2 ? ` ${class1}` : !class1 && class2 ? class2 : '';
}
