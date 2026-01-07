/**
 * SpotBugs test file - intentionally dirty code for bytecode analysis
 * Contains multiple SpotBugs bug patterns for demonstration
 * NOTE: Requires compilation to .class files for SpotBugs to analyze
 */
package testfixtures;

import java.io.*;
import java.util.*;

public class SpotBugsIssues {

    // MS_MUTABLE_ARRAY - public static mutable array
    public static final String[] MUTABLE_ARRAY = {"a", "b", "c"};
    
    // URF_UNREAD_FIELD - unread field
    private int unreadField = 42;
    
    // EI_EXPOSE_REP - returns reference to mutable object
    private Date date = new Date();
    public Date getDate() {
        return date;  // Bug: exposes internal representation
    }

    // NP_ALWAYS_NULL - Null value is always dereferenced
    public void alwaysNull() {
        String s = null;
        System.out.println(s.length());  // Bug: s is always null
    }

    // ES_COMPARING_STRINGS_WITH_EQ - String comparison using ==
    public boolean stringEqualityBug(String a, String b) {
        return a == b;  // Bug: should use .equals()
    }
    
    // DM_BOXED_PRIMITIVE_FOR_PARSING - inefficient number parsing
    public int inefficientParse(String s) {
        return Integer.valueOf(s).intValue();  // should be Integer.parseInt(s)
    }
    
    // RCN_REDUNDANT_NULLCHECK_OF_NONNULL_VALUE - redundant null check
    public void redundantNullCheck() {
        String s = "hello";
        if (s != null) {  // Bug: s can never be null
            System.out.println(s);
        }
    }
    
    // DLS_DEAD_LOCAL_STORE - dead store to local variable
    public void deadStore() {
        int x = 5;  // Bug: value is never used
        x = 10;
        System.out.println(x);
    }
    
    // SBSC_USE_STRINGBUFFER_CONCATENATION - string concatenation in loop
    public String inefficientConcat(String[] items) {
        String result = "";
        for (String item : items) {
            result += item;  // Bug: should use StringBuilder
        }
        return result;
    }
    
    // BC_UNCONFIRMED_CAST - unchecked/unconfirmed cast
    public String unsafeCast(Object obj) {
        return (String) obj;  // Bug: cast may fail
    }
    
    // DM_DEFAULT_ENCODING - reliance on default encoding
    public void defaultEncoding() throws IOException {
        FileReader reader = new FileReader("file.txt");  // Bug: should specify encoding
        reader.close();
    }
    
    // OS_OPEN_STREAM - stream not closed
    public void unclosedStream() throws IOException {
        FileInputStream fis = new FileInputStream("file.txt");  // Bug: never closed
        fis.read();
    }
    
    // SE_BAD_FIELD - non-transient non-serializable field in serializable class
    public static class BadSerializable implements Serializable {
        private Thread thread;  // Bug: Thread is not serializable
    }

    public static void main(String[] args) {
        System.out.println("SpotBugs test file");
    }
}
