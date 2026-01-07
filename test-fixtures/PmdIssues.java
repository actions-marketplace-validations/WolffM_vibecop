/**
 * PMD test file - intentionally dirty code for Java code analysis
 * Contains multiple PMD rule violations for demonstration
 */
package testfixtures;

import java.util.*;  // UnusedImports - importing more than needed

public class PmdIssues {

    // UnusedPrivateField - PMD rule violation
    private String unusedField = "never used";
    
    // UnusedPrivateField - another unused field
    private int unusedNumber = 42;
    
    // AvoidDuplicateLiterals - duplicate string literals
    private String dup1 = "duplicate literal string";
    private String dup2 = "duplicate literal string";
    private String dup3 = "duplicate literal string";

    // EmptyCatchBlock - PMD rule violation
    public void emptyCatch() {
        try {
            throw new RuntimeException("test");
        } catch (RuntimeException e) {
            // intentionally empty catch block
        }
    }
    
    // CyclomaticComplexity / NPathComplexity - too complex
    public int complexMethod(int a, int b, int c, int d) {
        int result = 0;
        if (a > 0) {
            if (b > 0) {
                if (c > 0) {
                    if (d > 0) {
                        result = 1;
                    } else {
                        result = 2;
                    }
                } else {
                    result = 3;
                }
            } else {
                result = 4;
            }
        }
        return result;
    }
    
    // ShortMethodName - method name too short
    public void x() {
        // do nothing
    }
    
    // ShortVariable - variable name too short
    public void shortVars() {
        int a = 1;
        int b = 2;
        int c = a + b;
    }
    
    // UseCollectionIsEmpty - should use isEmpty()
    public boolean checkEmpty(List<String> list) {
        return list.size() == 0;  // Should be list.isEmpty()
    }
    
    // SystemPrintln - use logging instead
    public void badLogging() {
        System.out.println("This should use a logger");
        System.err.println("This too");
    }
    
    // AvoidReassigningParameters
    public int reassignParam(int value) {
        value = value * 2;  // reassigning parameter
        return value;
    }
    
    // UselessParentheses
    public int uselessParens(int a, int b) {
        return (a + b);  // parentheses not needed
    }
    
    // LocalVariableCouldBeFinal
    public void notFinal() {
        String s = "hello";  // could be final
        System.out.println(s);
    }
    
    // MethodArgumentCouldBeFinal
    public void argNotFinal(String input) {
        System.out.println(input);
    }

    public static void main(String[] args) {
        System.out.println("PMD test file");
    }
}
